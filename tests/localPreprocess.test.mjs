import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCoptic } from '../lib/localTranslation/preprocess.mjs';

test('preserves model dialect tags and Coptic letter preprocessing', () => {
  assert.equal(prepareCoptic(' ⲠⲈⲚⲚⲞⲨϮ '), 'б πεννουt');
  assert.equal(prepareCoptic('ⲓⲏⲥ ⲡⲭⲥ', 'sahidic'), 'з ιησ πχσ');
  assert.throws(() => prepareCoptic(''), /Enter Coptic/);
  assert.throws(() => prepareCoptic('ⲁ', 'unknown'), /Bohairic or Sahidic/);
  assert.throws(() => prepareCoptic('ⲁ'.repeat(1201)), /short passages/);
});
