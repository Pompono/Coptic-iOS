import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMarkComponents, inkComponents, reviewableMarks } from '../lib/scanner/markShape.mjs';
const bodies = [10, 35, 60].map(x => ({ x, y: 30, width: 12, height: 40, area: 180, slope: 0 }));
test('image hints distinguish long flat bars from short slanted marks', () => {
  const bar = { x: 8, y: 10, width: 65, height: 3, area: 195, slope: 0 };
  const grave = { x: 12, y: 12, width: 9, height: 6, area: 20, slope: -.6 };
  assert.equal(classifyMarkComponents([...bodies, bar], 'ⲙ̄ⲁ').kind, 'overline-like');
  assert.equal(classifyMarkComponents([...bodies, grave], 'ⲙ̄ⲁ').kind, 'jinkem-like');
  assert.equal(classifyMarkComponents([...bodies, { ...grave, slope: 0, height: 2 }], 'ⲙ̄ⲁ').kind, 'uncertain');
});
test('text skew is removed and sacred-name abbreviations stay uncertain', () => {
  const grave = { x: 12, y: 12, width: 9, height: 6, area: 20, slope: .4 };
  assert.equal(classifyMarkComponents([...bodies, grave], 'ⲙ̄ⲁ', .4).kind, 'uncertain');
  assert.equal(classifyMarkComponents([...bodies, grave], 'ⲭ̅ⲥ̅').kind, 'uncertain');
  assert.equal(classifyMarkComponents([], 'ⲙ̄ⲁ').kind, 'uncertain');
});
test('ink extraction finds separate components without assuming a white paper colour', () => {
  const width = 20, height = 20, gray = new Uint8Array(width * height).fill(205);
  for (let y = 2; y <= 3; y++) for (let x = 4; x <= 12; x++) gray[y * width + x] = 30;
  for (let y = 9; y <= 17; y++) for (let x = 4; x <= 9; x++) gray[y * width + x] = 30;
  const components = inkComponents(gray, width, height);
  assert.equal(components.length, 2);
  assert.deepEqual(components.map(item => [item.width, item.height]), [[9, 2], [6, 9]]);
});
test('word-position corrections reject text edits that invalidate OCR coordinates', () => {
  assert.equal(reviewableMarks('ⲙ̀ⲁ', 'ⲙ̄ⲁ'), true);
  assert.equal(reviewableMarks('ⲛ̀ⲁ', 'ⲙ̄ⲁ'), false);
  assert.equal(reviewableMarks('ⲙ̀ⲙⲁ', 'ⲙ̄ⲁ'), false);
});
