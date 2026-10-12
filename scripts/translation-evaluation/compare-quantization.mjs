import { env, pipeline } from '@huggingface/transformers';
import { readFile, writeFile } from 'node:fs/promises';
import { prepareCoptic } from '../../lib/localTranslation/preprocess.mjs';
import { decodeTranslation } from '../../lib/localTranslation/decode.mjs';
const suite=JSON.parse(await readFile(new URL('./cases.json',import.meta.url)));
const results=suite.cases.filter(row=>!/[\d\[\]\u25a1]/u.test(row.text)).map(row=>({...row}));
env.allowRemoteModels=false;
for(const [label,root] of [['old','./public/models/'],['perChannel','/tmp/coptic-per-channel-models/']]) {
 env.localModelPath=root;
 const translator=await pipeline('text2text-generation','coptic-english',{device:'cpu',dtype:'q8',local_files_only:true});
 try {
  for(const row of results) {
   const prepared=prepareCoptic(row.text,row.dialect,{normalizeMarks:false});
   row.tokens=translator.tokenizer(prepared,{return_tensor:false}).input_ids.length;
   if(row.tokens>128){row.excluded='Outside the model training source-token window';continue;}
   row[label]=await decodeTranslation(translator,prepared,{maxInputTokens:512,maxNewTokens:96});console.log(JSON.stringify({id:row.id,english:row.english,label,output:row[label]}));
  }
 }finally{await translator.dispose();}
}
await writeFile('/tmp/coptic-quantization-comparison.json',JSON.stringify({source:suite.source,revision:suite.revision,results},null,2));
