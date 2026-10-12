import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTranslationInput, checkTranslationOutput } from '../lib/localTranslation/quality.mjs';
test('rejects photographed OCR artifacts rather than guessing missing letters', () => {
  for (const text of ['ⲉ 4 ⲙⲁⲣⲓⲁ', '[[ⲑⲟ ⲧⲉ ⲧϣⲏⲣⲓ', 'ⲍ □ ⲛⲁⲛ']) assert.throws(() => checkTranslationInput(text), /Correct the Coptic/);
  assert.doesNotThrow(() => checkTranslationInput('ⲭⲉⲣⲉ ⲛⲉ ⲙⲁⲣⲓⲁ: ⲑⲃ ⲣⲱⲙⲡⲓ ⲉⲑⲛⲉⲥⲱⲥ: ⲑⲏⲉ̀ⲧⲁⲥⲙⲓⲥⲓ ⲛⲁⲛ: ⲙ̀ⲫϯ ⲡⲓⲗⲟⲅⲟⲥ.'));
});
test('rejects the repeated invented phrase from the user screenshot', () => {
  assert.throws(() => checkTranslationOutput('Thou hast born a fifth; and thou hast born a fifth; and thou hast born a fifth; and thou hast born a fifth'), /unreliable translation/);
  assert.doesNotThrow(() => checkTranslationOutput('You are the daughter of the righteous, who sprang from the root of Jesse.'));
});
