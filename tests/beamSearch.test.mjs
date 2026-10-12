import test from 'node:test';
import assert from 'node:assert/strict';
import { beamSearch } from '../lib/localTranslation/beamSearch.mjs';
test('keeps the better full sequence even when its first token is not greedy', async () => {
  const caches = [];
  const tokens = await beamSearch(async (tokens, state) => {
    if (tokens.length > 1) assert.equal(state, 'root');
    caches.push(tokens);
    // Token 1 initially wins, but token 2 has the more probable completion.
    const logits = tokens.length === 1 ? [-20, 1, .9, -20] : tokens.at(-1) === 2 ? [5, -5, -5, -20] : [0, 0, 0, -20];
    return { logits, state: tokens.length === 1 ? 'root' : 'child' };
  }, { startToken: 3, eosToken: 0, padToken: 3, width: 2, maxTokens: 2 });
  assert.deepEqual(tokens, [3, 2, 0]);
  assert.ok(caches.some(tokens => tokens.at(-1) === 1));
});
test('does not silently accept truncated or invalid generations', async () => {
  await assert.rejects(beamSearch(async () => ({ logits: [-Infinity, 1, -Infinity], state: null }), { startToken: 2, eosToken: 0, padToken: 2, width: 1, maxTokens: 2 }), /did not finish/);
  await assert.rejects(beamSearch(async () => ({ logits: [NaN, -Infinity], state: null }), { startToken: 1, eosToken: 0, padToken: 1 }), /invalid scores/);
});
