"""Experimental CPU LoRA adaptation. Never publishes weights automatically.

Validation is excluded from adapter training by normalized Coptic key. Original
model pretraining overlap is unknown, so this is not an unseen-model benchmark.
"""
import argparse, csv, io, json, random, re, time, urllib.request
from pathlib import Path
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
from peft import LoraConfig, TaskType, get_peft_model

MODEL='megalaa/coptic-english-translator'
REVISION='c5ccdb3aabb93c9962a0ae6d7305abfe8895d91d'
CORPUS_REVISION='5b836707150687b46667fc5a0a596e9f4b3cd11d'
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--steps',type=int,default=120)
parser.add_argument('--learning-rate',type=float,default=5e-5)
parser.add_argument('--run-name',default='initial')
args=parser.parse_args()
if not 1 <= args.steps <= 5000: parser.error('steps must be between 1 and 5000')
if not args.run_name.replace('-','').isalnum(): parser.error('run-name must be alphanumeric')
OUTPUT=ROOT/'.model-adaptation'/args.run_name
OUTPUT.mkdir(parents=True,exist_ok=True)
torch.set_num_threads(2)
random.seed(42); torch.manual_seed(42)
letters=dict(zip('ⲁⲃⲅⲇⲉⲋⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱϣϥϧϩϫϭϯ','αβγδεϛζηθικλμνξοπρστυφχψωsfkhjct'))
def key(text):
    import unicodedata
    return re.sub(r'[^Ⲁ-⳯Ϣ-ϯ]','',unicodedata.normalize('NFD',text).lower())
def prepare(text, dialect='bohairic'):
    import unicodedata
    text=''.join(ch for ch in unicodedata.normalize('NFD',text.lower()) if not unicodedata.combining(ch))
    return ('б ' if dialect=='bohairic' else 'з ')+''.join(letters.get(ch,ch) for ch in text)

print('Loading pinned base model and original SentencePiece tokenizer',flush=True)
tokenizer=AutoTokenizer.from_pretrained(MODEL,revision=REVISION)
base=AutoModelForSeq2SeqLM.from_pretrained(MODEL,revision=REVISION)
cases=json.loads((ROOT/'scripts/translation-evaluation/cases.json').read_text())['cases']
validation=[]
for row in cases:
    if re.search(r'[0-9\[\]]',row['text']) or len(key(row['text']))<25:continue
    encoded=tokenizer(prepare(row['text']),return_tensors='pt')
    if encoded['input_ids'].shape[-1]<=128:validation.append(row)
heldout={key(row['text']) for row in cases}
with urllib.request.urlopen(f'https://huggingface.co/datasets/megalaa/coptic-corpora/resolve/{CORPUS_REVISION}/tasbeha_test.csv',timeout=30) as r:
    heldout.update(key(row['cop_boh']) for row in csv.DictReader(io.StringIO(r.read().decode())))

def evaluate(model,label):
    model.eval(); results=[]
    for row in validation:
        with torch.no_grad():
            inputs=tokenizer(prepare(row['text']),return_tensors='pt')
            generated=model.generate(**inputs,num_beams=4,max_new_tokens=96,do_sample=False)
        output=tokenizer.decode(generated[0],skip_special_tokens=True)
        results.append(dict(row,output=output));print(json.dumps({'phase':label,'id':row['id'],'output':output}),flush=True)
    (OUTPUT/(label+'.json')).write_text(json.dumps(results,ensure_ascii=False,indent=2))
    return results

evaluate(base,'baseline')
with urllib.request.urlopen(f'https://huggingface.co/datasets/megalaa/coptic-corpora/resolve/{CORPUS_REVISION}/tasbeha_train.csv',timeout=30) as r:
    rows=list(csv.DictReader(io.StringIO(r.read().decode())))
unique={}; conflicts=set()
for row in rows:
    text,english=row['cop_boh'],row['en']; normalized=key(text)
    if normalized in heldout or len(normalized)<25 or re.search(r'[0-9\[\]]',text):continue
    if normalized in unique and unique[normalized][1]!=english:conflicts.add(normalized)
    else:unique[normalized]=(text,english)
training=[]
for normalized,(text,english) in unique.items():
    if normalized in conflicts:continue
    source=tokenizer(prepare(text))
    target=tokenizer(text_target=english)
    if len(source['input_ids'])<=128 and len(target['input_ids'])<=128:
        training.append((source,target['input_ids']))
random.shuffle(training)
print(json.dumps({'trainingRows':len(training),'heldoutKeys':len(heldout),'validationRows':len(validation)}),flush=True)
model=get_peft_model(base,LoraConfig(task_type=TaskType.SEQ_2_SEQ_LM,r=8,lora_alpha=16,lora_dropout=.05,target_modules=['q_proj','v_proj']))
model.print_trainable_parameters()
optimizer=torch.optim.AdamW([parameter for parameter in model.parameters() if parameter.requires_grad],lr=args.learning_rate)
model.train(); started=time.monotonic(); steps=args.steps
for step in range(steps):
    batch=[training[(step*2+offset)%len(training)] for offset in range(2)]
    inputs=tokenizer.pad([row[0] for row in batch],return_tensors='pt')
    length=max(len(row[1]) for row in batch)
    labels=torch.tensor([row[1]+[-100]*(length-len(row[1])) for row in batch])
    optimizer.zero_grad(set_to_none=True)
    loss=model(**inputs,labels=labels).loss
    if not torch.isfinite(loss):raise RuntimeError('Non-finite training loss')
    loss.backward();torch.nn.utils.clip_grad_norm_(model.parameters(),1.0);optimizer.step()
    if step%10==0 or step==steps-1:print(json.dumps({'step':step+1,'steps':steps,'loss':round(loss.item(),4),'elapsedSeconds':round(time.monotonic()-started)}),flush=True)
evaluate(model,'adapted')
model.save_pretrained(OUTPUT/'adapter')
(OUTPUT/'provenance.json').write_text(json.dumps({'model':MODEL,'revision':REVISION,'datasetRevision':CORPUS_REVISION,'seed':42,'steps':steps,'learningRate':args.learning_rate,'trainingRows':len(training),'trainingRowsUsed':steps*2,'validationExcludedBy':'normalized Coptic keys including entire tasbeha_test.csv','pretrainingOverlap':'unknown','status':'experimental; not approved for app distribution'},indent=2))
print('Experiment finished. Adapter saved locally; no production model has changed.',flush=True)
