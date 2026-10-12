import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWordIndex, lookupWord, passageTokens } from '../lib/reading/text.mjs';
import { createCard, gradeCard, dueCards, parseDeck } from '../lib/vocabulary/schedule.mjs';
const noun = { id: 'name', lemma: 'ⲣⲁⲛ', forms: ['ⲣⲉⲛ-', 'pl. names'], pos: 'Noun (masculine)', dialect: 'bohairic', gloss: ['Name'] };

test('passage tokens preserve spacing, punctuation, and combining marks', () => {
  const text = 'ⲡⲓⲣⲱⲙⲓ,  ⲓ̄ⲏ̄ⲥ̄.\nEnglish';
  const tokens = passageTokens(text);
  assert.equal(tokens.map(token => token.text).join(''), text);
  assert.deepEqual(tokens.filter(token => token.word).map(token => token.text), ['ⲡⲓⲣⲱⲙⲓ', 'ⲓ̄ⲏ̄ⲥ̄']);
});
test('lookup distinguishes exact forms, mark-insensitive matches, and possible articles', () => {
  const index = makeWordIndex([noun]);
  assert.equal(lookupWord(index, 'ⲣⲉⲛ').matches[0].lemma, 'ⲣⲁⲛ');
  assert.equal(lookupWord(index, 'ⲣ̄ⲁⲛ').ignoresMarks, true);
  assert.equal(lookupWord(index, 'ⲡⲓⲣⲁⲛ').analyses[0].stem, 'ⲣⲁⲛ');
  assert.equal(lookupWord(index, 'ⲡⲓⲝⲝⲝ').analyses.length, 0);
  assert.equal(lookupWord(index, 'ϯⲣⲁⲛ').analyses.length, 0, 'Reject a feminine article analysis for an exclusively masculine noun');
  assert.equal(index.exact.has('pl. names'), false);
});
test('unknown dialect entries are excluded in Bohairic-only mode', () => {
  const index = makeWordIndex([{ ...noun, dialect: 'unknown' }]);
  assert.equal(lookupWord(index, 'ⲣⲁⲛ').matches.length, 0);
  assert.equal(lookupWord(index, 'ⲣⲁⲛ', false).matches.length, 1);
});
test('review scheduling learns successes and brings failures back sooner', () => {
  const now = 1000000;
  const card = createCard({ word: 'ⲣⲁⲛ', meaning: 'Name' }, now);
  const good = gradeCard(card, 'good', now);
  assert.equal(good.dueAt, now + 86400000);
  const next = gradeCard(good, 'good', good.dueAt);
  assert.equal(next.intervalDays, 3);
  const failed = gradeCard(next, 'again', next.dueAt);
  assert.equal(failed.dueAt, next.dueAt + 600000);
  assert.equal(failed.lapses, 1);
  assert.equal(failed.streak, 0);
  assert.equal(gradeCard(failed, 'good', failed.dueAt).intervalDays, 1);
  assert.equal(gradeCard(card, 'easy', now).intervalDays, 4);
});
test('due queue prioritizes difficult words and excludes future cards', () => {
  const card = createCard({ word: 'ⲣⲁⲛ', meaning: 'Name' }, 1000);
  assert.deepEqual(dueCards([card, { ...card, id: 'weak', lapses: 2 }, { ...card, id: 'future', dueAt: 3000 }], 2000).map(item => item.id), ['weak', card.id]);
});
test('saved deck rejects corruption and unsupported versions without erasing it', () => {
  const card = createCard({ word: 'ⲣⲁⲛ', meaning: 'Name' }, 1000);
  assert.deepEqual(parseDeck(JSON.stringify({ version: 1, cards: [card] })), [card]);
  assert.throws(() => parseDeck(JSON.stringify({ version: 2, cards: [] })));
  assert.throws(() => parseDeck(JSON.stringify({ version: 1, cards: [{ ...card, dueAt: 'tomorrow' }] })));
  assert.throws(() => parseDeck(JSON.stringify({ version: 1, cards: [card, card] })));
});
