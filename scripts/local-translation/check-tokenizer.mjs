import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MarianTokenizer } from '../../node_modules/@huggingface/transformers/src/tokenizers.js';
const base = 'public/models/coptic-english/';
const tokenizer = new MarianTokenizer(JSON.parse(await readFile(base + 'tokenizer.json')), JSON.parse(await readFile(base + 'tokenizer_config.json')));
const fixtures = JSON.parse(await readFile('scripts/local-translation/tokenizer-fixtures.json'));
for (const fixture of fixtures) {
  assert.deepEqual(tokenizer(fixture.text, { return_tensor: false }).input_ids, fixture.ids, fixture.text);
}
console.log(`PASS: ${fixtures.length} token sequences match the upstream Python tokenizer.`);
