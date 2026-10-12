import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeReferenceIndex, matchReference } from '../lib/localTranslation/reference.mjs';
import { suggestionEntries, suggestSources, characterDiff } from '../lib/scanner/sourceSuggestions.mjs';
const corpus = JSON.parse(readFileSync(new URL('../public/reference-translation/bohairic.json', import.meta.url)));
const index = makeReferenceIndex(corpus.rows, corpus.selectedRows);
const entries = suggestionEntries(index);
test('finds the Mary stanza despite missing chi and an OCR artifact, without accepting a translation', () => {
 const broken = 'ⲉⲣⲉ ⲛⲉ ⲙⲁⲣⲓⲁ: ϯϭⲣⲟⲙⲡⲓ ⲉⲑⲛⲉⲥⲱⲥ: ⲑⲏⲉⲧⲁⲥⲙⲓⲥⲓ ⲛⲁⲛ: ⲙ̀ⲫϯ ⲡⲓⲗⲟⲅⲟⲥ □';
 assert.equal(matchReference(index, broken, 'bohairic'), null);
 const suggestions = suggestSources(entries, broken);
 assert.ok(suggestions.some(item => /ⲭⲉⲣⲉ ⲛⲉ ⲙⲁⲣⲓⲁ/.test(item.text)));
 assert.ok(suggestions.length <= 3);
 assert.ok(suggestions.every(item => !('translation' in item)));
 const source = suggestions.find(item => item.text.startsWith('ⲭⲉⲣⲉ ⲛⲉ ⲙⲁⲣⲓⲁ'));
 assert.match(matchReference(index, source.text, 'bohairic').translation, /beautiful dove/);
});
test('does not propose passages for short fragments, unrelated text, or already matching letters', () => {
 assert.deepEqual(suggestSources(entries, 'ⲭ'), []);
 assert.deepEqual(suggestSources(entries, 'abcdefghijklmnopqrstuv'), []);
 const fake = suggestionEntries(makeReferenceIndex([['ⲁ'.repeat(40), 'English', 'test', 1]]));
 assert.deepEqual(suggestSources(fake, 'ⲁ'.repeat(40)), []);
 assert.deepEqual(suggestSources(fake, 'ⲃ'.repeat(40)), []);
});
test('diff reconstruction preserves original marks and highlights missing and wrong letters', () => {
 const before = 'ⲡϪⲥ ⲙ̄', after = 'ⲡⲭⲥ ⲙ̀ ⲭ';
 const diff = characterDiff(before, after);
 assert.equal(diff.map(item => item.before).join(''), before);
 assert.equal(diff.map(item => item.after).join(''), after);
 assert.ok(diff.some(item => item.changed && item.before === 'Ϫ' && item.after === 'ⲭ'));
 assert.ok(characterDiff('ⲡⲥ', 'ⲡⲭⲥ').some(item => item.changed && item.before === '' && item.after === 'ⲭ'));
});
