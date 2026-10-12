import { env, pipeline } from '@huggingface/transformers';
import { readFile, writeFile } from 'node:fs/promises';
import { prepareCoptic } from '../../lib/localTranslation/preprocess.mjs';
import { decodeTranslation } from '../../lib/localTranslation/decode.mjs';
env.allowRemoteModels=false;env.localModelPath='./public/models/';
const translator=await pipeline('text2text-generation','coptic-english',{device:'cpu',dtype:'q8',local_files_only:true});
const evaluation=JSON.parse(await readFile('/tmp/coptic-evaluation.json'));
try {
 for(const row of evaluation.results) {
  if(/\d/.test(row.text)){row.excluded='Contains verse-number artifacts rejected by the app';continue;}
  row.marksOnly=await decodeTranslation(translator,prepareCoptic(row.printed.normalize('NFD').replace(/[\u0300-\u036f]/g,''),row.dialect,{normalizeMarks:false}),{maxInputTokens:512,maxNewTokens:96});
  console.log(JSON.stringify({id:row.id,expected:row.english,current:row.current,normalized:row.normalized,marksOnly:row.marksOnly}));
 }
 await writeFile('/tmp/coptic-evaluation-marks.json',JSON.stringify(evaluation,null,2));
} finally{await translator.dispose();}
