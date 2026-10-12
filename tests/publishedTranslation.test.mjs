import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { referenceKey, makeReferenceIndex, matchReference } from '../lib/localTranslation/reference.mjs';
const corpus = JSON.parse(readFileSync(new URL('../public/reference-translation/bohairic.json', import.meta.url)));
const index = makeReferenceIndex(corpus.rows, corpus.selectedRows);
test('matches the photographed flower, rod, and Mary stanzas to existing English', () => {
 const flower = matchReference(index, 'ⲛⲑⲟ ⲧⲉ ϯϩⲣⲏⲣⲓ: ⲛ̀ⲧⲉ ⲡⲓⲥⲑⲟⲓⲛⲟⲩϥⲓ: ⲑⲏⲉⲧⲁⲥⲫⲓⲣⲓ ⲉ̀ⲃⲟⲗ: ϧⲉⲛ ⲑⲛⲟⲩⲛⲓ ⲛ̀ⲓⲉⲥⲥⲉ.', 'bohairic');
 assert.match(flower.translation, /flower.*incense.*blossomed.*Jesse/);
 assert.ok(flower.sourceRow);
 const rod = matchReference(index, 'ⲡⲓϣⲃⲱⲧ ⲛ̀ⲧⲉ ⲁⲁⲣⲱⲛ: ⲉⲧⲁϥⲫⲓⲣⲓ ⲉ̀ⲃⲟⲗ: ⲭⲱⲣⲓⲥ ϭⲟ ⲛⲉⲙ ⲧⲥⲟ: ϥⲟⲓ ⲛ̀ⲧⲩⲡⲟⲥ ⲛⲉ.', 'bohairic');
 assert.match(rod.translation, /rod of Aaron.*without planting or watering/);
 const mary = matchReference(index, 'Ⲭⲉⲣⲉ ⲛⲉ Ⲙⲁⲣⲓⲁ: ϯϭⲣⲟⲙⲡⲓ ⲉⲑⲛⲉⲥⲱⲥ: ⲑⲏⲉⲧⲁⲥⲙⲓⲥⲓ ⲛⲁⲛ: ⲙ̀ⲫϯ ⲡⲓⲗⲟⲅⲟⲥ.', 'bohairic');
 assert.match(mary.translation, /Mary.*beautiful dove.*God the Word/);
});
test('refuses missing letters, foreign symbols, different dialects and conflicting references', () => {
 const row = corpus.rows.find(row => row[0].startsWith('ⲛⲑⲟ ⲧⲉ ϯϩⲣⲏⲣⲓ') && row[0].includes('ⲓⲉⲥⲥⲉ'));
 for (const text of [row[0].slice(1), row[0] + ' 4', row[0] + ' [[', row[0] + ' □', row[0] + ' x', row[0].replace('ϯϩⲣⲏⲣⲓ', 'ⲧϣⲏⲣⲓ')]) assert.equal(matchReference(index, text, 'bohairic'), null);
 assert.equal(matchReference(index, row[0], 'sahidic'), null);
 const conflicting = makeReferenceIndex([row, [row[0], 'A different meaning.', 'test', 2]]);
 assert.equal(matchReference(conflicting, row[0], 'bohairic'), null);
 assert.equal(referenceKey('□'), null);
});
