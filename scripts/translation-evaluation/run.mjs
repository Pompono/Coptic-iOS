import { env, pipeline } from '@huggingface/transformers';
import { readFile, writeFile } from 'node:fs/promises';
import { prepareCoptic } from '../../lib/localTranslation/preprocess.mjs';
import { decodeTranslation } from '../../lib/localTranslation/decode.mjs';
const suite = JSON.parse(await readFile(new URL('./cases.json', import.meta.url)));
env.allowRemoteModels = false; env.localModelPath = process.env.COPTIC_MODEL_ROOT || './public/models/';
const translator = await pipeline('text2text-generation', 'coptic-english', { device: 'cpu', dtype: process.env.COPTIC_DTYPE || 'q8', local_files_only: true });
function chrF(hypothesis, reference) {
 const normalize = text => text.toLowerCase().replace(/\s/g, '');
 const a=normalize(hypothesis),b=normalize(reference); let precision=0,recall=0;
 for(let n=1;n<=6;n++) {
  const counts=text=>{const map=new Map();for(let i=0;i<=text.length-n;i++){const key=text.slice(i,i+n);map.set(key,(map.get(key)||0)+1);}return map;};
  const x=counts(a),y=counts(b);let overlap=0;for(const [key,count] of x) overlap+=Math.min(count,y.get(key)||0);
  precision+=overlap/Math.max(1,a.length-n+1);recall+=overlap/Math.max(1,b.length-n+1);
 }
 precision/=6;recall/=6;return precision+recall ? 5*precision*recall/(4*precision+recall):0;
}
// Candidate preprocessing aligns typography with the published corpus without
// changing the original displayed Coptic. Not shipped until evaluated.
function candidate(text) {
 return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\p{P}]/gu,' ').replace(/\s+/g,' ').trim();
}
const results=[];
try {
 for (const item of suite.cases) {
  // Add printed line/colon/jinkem formatting to challenge the actual pipeline.
  const printed=item.text.replace(/(^|\s)([ⲙⲛ])(?=[ⲁ-⳯ϣ-ϯ])/gu,'$1$2\u0300').replace(/ /g,(space,offset)=>offset%5===0?': ':space)+'.';
  const output={...item,printed};
  for(const [name,text] of [['current',printed],['normalized',candidate(printed)]]) {
   const start=performance.now();
   try { output[name]=await decodeTranslation(translator,prepareCoptic(text,item.dialect,{normalizeMarks:false}),{maxInputTokens:512,maxNewTokens:96}); output[name+'Score']=chrF(output[name],item.english); }
   catch(error){output[name+'Error']=error.message; output[name+'Score']=0;}
   output[name+'Ms']=Math.round(performance.now()-start);
  }
  results.push(output); console.log(JSON.stringify(output));
 }
 await writeFile(process.env.COPTIC_EVAL_OUTPUT || '/tmp/coptic-evaluation.json', JSON.stringify({ ...suite, results, currentChrF:results.reduce((sum,r)=>sum+r.currentScore,0)/results.length, normalizedChrF:results.reduce((sum,r)=>sum+r.normalizedScore,0)/results.length },null,2));
} finally { await translator.dispose(); }
