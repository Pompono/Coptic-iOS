import test from 'node:test';
import assert from 'node:assert/strict';
import { hasOverline, overlinesToJinkem } from '../lib/scanner/marks.mjs';
test('explicit jinkem correction changes only macron/overline marks', () => {
  const original = 'ⲙ̄ ⲛ̅ ⲓ̀ ⲓ̈ ⲓ︤ⲏ︥';
  assert.equal(hasOverline(original), true);
  assert.equal(overlinesToJinkem(original), 'ⲙ̀ ⲛ̀ ⲓ̀ ⲓ̈ ⲓ︤ⲏ︥');
  assert.equal(original, 'ⲙ̄ ⲛ̅ ⲓ̀ ⲓ̈ ⲓ︤ⲏ︥');
  assert.equal(hasOverline('ⲙ̀'), false);
});
