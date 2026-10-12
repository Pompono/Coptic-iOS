import { env, pipeline } from '@huggingface/transformers';
import { prepareCoptic } from '../../lib/localTranslation/preprocess.mjs';
import { decodeTranslation } from '../../lib/localTranslation/decode.mjs';
env.allowRemoteModels = false;
env.localModelPath = process.env.COPTIC_MODEL_ROOT || './public/models/';
const translator = await pipeline('text2text-generation', 'coptic-english', { dtype: process.env.COPTIC_DTYPE || 'q8', device: 'cpu', local_files_only: true });
const cases = process.env.COPTIC_TEXT ? [{ input: process.env.COPTIC_TEXT }] : [
 { input: 'ⲡⲉⲛⲛⲟⲩϯ', expected: 'our God' },
 { input: 'ⲓⲏⲥ ⲡⲭⲥ', expected: 'Jesus Christ' },
 { input: 'ⲛⲑⲟ ⲧⲉ ⲧϣⲉⲣⲓ', expected: 'You are the daughter' },
 // Photo-inspired transcriptions are diagnostic cases, not verified gold text.
 { input: 'ⲛⲑⲟ ⲧⲉ ⲧϣⲉⲣⲓ: ⲛ̀ⲧⲉ ⲡⲓⲑⲙⲏⲓⲛⲟⲩϯ: ⲑⲏⲉⲧⲁⲥϥⲓⲣⲓ ⲉ̀ⲃⲟⲗ: ϧⲉⲛ ⲑⲛⲟⲩⲛⲓ ⲛ̀ⲓⲉⲥⲥⲉ.' },
 { input: 'ⲭⲉⲣⲉ ⲛⲉ ⲙⲁⲣⲓⲁ: ⲑⲃ ⲣⲱⲙⲡⲓ ⲉⲑⲛⲉⲥⲱⲥ: ⲑⲏⲉⲧⲁⲥⲙⲓⲥⲓ ⲛⲁⲛ: ⲙ̀ⲫϯ ⲡⲓⲗⲟⲅⲟⲥ.' },
];
try {
 for (const example of cases) {
  const input = prepareCoptic(example.input, 'bohairic');
  const greedy = (await translator(input, { num_beams: 1, max_new_tokens: 64 }))[0].generated_text;
  const started = performance.now();
  const beam = await decodeTranslation(translator, input);
  console.log(JSON.stringify({ ...example, greedy, beam, beamMs: Math.round(performance.now() - started) }));
 }
} finally { await translator.dispose(); }
