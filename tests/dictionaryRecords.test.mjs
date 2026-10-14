import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { makeWordIndex, lookupWord } from '../lib/reading/text.mjs';
const code = ts.transpileModule(await readFile('lib/dictionary.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { toEntryFromBohairic } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const raw = JSON.parse(await readFile('public/bohairic_dictionary.json', 'utf8'));
test('reader lookup retains distinct source meanings sharing a headword, POS and source', () => {
  const entries = raw.map(toEntryFromBohairic), index = makeWordIndex(entries);
  const eating = entries.filter(e => e.lemma === 'ⲟⲩⲱⲙ');
  assert.ok(new Set(eating.map(e => e.gloss.join(';'))).size > 1);
  assert.equal(new Set(eating.map(e => e.id)).size, eating.length);
  const found = lookupWord(index, 'ⲟⲩⲱⲙ').matches;
  for (const entry of eating) assert.ok(found.some(e => e.id === entry.id), entry.gloss.join(';'));
  // Across all headwords, distinct meanings must never share a lookup ID.
  const byId = new Map();
  for (const e of entries) {
    const meaning = e.gloss.join(';');
    if (byId.has(e.id)) assert.equal(byId.get(e.id), meaning);
    byId.set(e.id, meaning);
  }
  assert.deepEqual(raw.map(toEntryFromBohairic).map(e => e.id), entries.map(e => e.id), 'IDs persist across reloads');
});
