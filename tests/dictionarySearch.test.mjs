import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { indexSearchEntry, searchDictionary, suggestDictionary, normalizeSearch, transliterationIndex, transliterationMatch, crossReferences } from '../lib/dictionary/search.mjs';
const raw = JSON.parse(await readFile('public/bohairic_dictionary.json', 'utf8'));
const index = raw.map(r => indexSearchEntry({ lemma: r.word, forms: r.bohairic_variants, gloss: r.senses, pos: r.pos, dialect: 'boh', examples: r.bohairic_examples, crum: r.crum_ref, etymology: r.etymology, greek: r.greek_origin, tag: r.scriptorium_tag }));
const search = options => searchDictionary(index, options);
test('all source records and exact marked spellings are preserved', () => {
  assert.equal(search({}).length, 8134);
  assert.equal(search({ query: 'ⲁ' })[0].lemma, 'ⲁ');
  assert.equal(search({ query: 'ⲁ̄' })[0].lemma, 'ⲁ̄');
  assert.ok(search({ query: 'ⲁ', scope: 'coptic', ignoreMarks: false }).every(e => e.lemma !== 'ⲁ̄'));
  assert.equal(normalizeSearch('  LOVE\t of  God '), 'love of god');
});
test('transliteration uses the desktop conventions, respects scopes, and explains evidence', () => {
  for (const query of ['agape', 'agapi', 'AGAPEE', 'agap']) {
    const result = search({ query, scope: 'transliteration' }).find(e => e.lemma === 'ⲁⲅⲁⲡⲏ');
    assert.ok(result, query); assert.match(result.matchLabel, /approximate/); assert.equal(result.matchEvidence, 'ⲁⲅⲁⲡⲏ');
  }
  assert.equal(transliterationMatch(transliterationIndex('ϣⲁⲓ'), 'shai'), 0);
  assert.equal(transliterationMatch(transliterationIndex('ϣⲁⲓ'), 's'), 1);
  assert.equal(transliterationMatch(transliterationIndex('ϣⲁⲓ'), 'shait'), -1);
  assert.equal(search({ query: 'agape', scope: 'coptic' }).length, 0);
  assert.equal(search({ query: 'agape', scope: 'transliteration', initial: 'ϣ' }).length, 0);
});
const fixture = [
  { lemma: 'ⲁ', gloss: ['Cattle'] }, { lemma: 'ⲃ', gloss: ['A small cat sleeps'] },
  { lemma: 'ⲅ', gloss: ['Cat.'] }, { lemma: 'ⲇ', gloss: ['See: ⲅ - Cat.'], pos: 'Cross-reference' },
  { lemma: 'ⲉ', gloss: ['To drink fresh water.'] }, { lemma: 'ⲍ', gloss: ['To love.'] },
  { lemma: 'ⲁⲅⲁⲡⲏ', gloss: ['Love'] }, { lemma: 'ⲏ', gloss: ['Agape'] },
  { lemma: 'ⲑ', forms: ['ϣⲁⲓ'], gloss: ['Test variant'], crum: '123a', etymology: 'borrowed Greek' },
].map(e => indexSearchEntry({ ...e, dialect: 'boh' }));
test('complete meanings outrank whole words, cross references, incidental substrings and transliteration', () => {
  assert.deepEqual(searchDictionary(fixture, { query: 'cat', scope: 'english' }).slice(0,2).map(e => e.lemma), ['ⲅ','ⲃ']);
  assert.equal(searchDictionary(fixture, { query: 'water drink', scope: 'english' })[0].lemma, 'ⲉ');
  assert.equal(searchDictionary(fixture, { query: 'to love', scope: 'english' })[0].lemma, 'ⲁⲅⲁⲡⲏ');
  assert.equal(searchDictionary(fixture, { query: 'agape' })[0].lemma, 'ⲏ');
  assert.equal(searchDictionary(fixture, { query: 'shai', scope: 'transliteration' })[0].matchEvidence, 'ϣⲁⲓ');
  assert.equal(searchDictionary(fixture, { query: '123a' })[0].lemma, 'ⲑ');
  assert.equal(searchDictionary(fixture, { query: 'borrowed' })[0].lemma, 'ⲑ');
});
test('conservative suggestions detect transpositions and respect filters without changing results', () => {
  assert.ok(suggestDictionary(fixture, { query: 'lvoe' }).includes('love'));
  assert.ok(suggestDictionary(fixture, { query: 'ⲁⲅⲁⲡⲓ', scope: 'coptic' }).includes('ⲁⲅⲁⲡⲏ'));
  assert.deepEqual(suggestDictionary(fixture, { query: 'ca' }), []);
  assert.deepEqual(suggestDictionary(fixture, { query: 'lvoe', pos: 'Missing' }), []);
  assert.deepEqual(suggestDictionary(fixture, { query: 'lvoe', scope: 'transliteration' }), []);
  assert.equal(searchDictionary(fixture, { query: 'lvoe' }).length, 0);
});
test('cross references resolve only real targets including variant parents', () => {
  assert.deepEqual(crossReferences({gloss:['See: (2)ϣⲁⲓ - Variant']}, fixture), ['ⲑ']);
  assert.deepEqual(crossReferences({gloss:['See: ⲭⲭⲭⲭ - Missing']}, fixture), []);
});
test('alphabet ordering and all filters apply consistently', () => {
  const sorted = search({});
  assert.ok(sorted.findIndex(e => e.lemma === 'ⲁ') < sorted.findIndex(e => e.lemma === 'ϣ'));
  assert.ok(search({ initial: 'ϣ' }).every(e => normalizeSearch(e.lemma).startsWith('ϣ')));
  const pos = raw.find(e => e.pos).pos;
  assert.ok(search({ pos }).every(e => e.pos === pos));
  assert.equal(search({ examplesOnly: true }).length, raw.filter(e => e.bohairic_examples?.length).length);
  assert.equal(searchDictionary([indexSearchEntry({lemma:'ⲁ',dialect:'unknown'})], { bohairicOnly:true }).length, 0);
});
