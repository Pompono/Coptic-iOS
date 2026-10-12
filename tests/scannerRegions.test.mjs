import test from 'node:test';
import assert from 'node:assert/strict';
import { cropBox, textRegions, MAX_REGIONS } from '../lib/scanner/regions.mjs';

const line = (text, bbox = { x0: 10, y0: 20, x1: 90, y1: 40 }) => ({ text, bbox, confidence: 70 });
const block = lines => ({ paragraphs: [{ lines }] });

test('Coptic regions exclude page numbers, preserve marks and clamp coordinates', () => {
  const result = textRegions([block([
    line('135'), line('ⲓ̄ⲏ̄ⲥ̄', { x0: -3, y0: 10, x1: 80, y1: 30 }),
    line('ⲡⲭⲥ', { x0: 20, y0: 40, x1: 120, y1: 120 }),
  ])], 100, 100);
  assert.equal(result.regions.length, 1);
  assert.equal(result.regions[0].text, 'ⲓ̄ⲏ̄ⲥ̄\nⲡⲭⲥ');
  assert.deepEqual(result.regions[0].box, { x: 0, y: .1, width: 1, height: .9 });
});

test('multi-column paragraphs retain recognition reading order', () => {
  const result = textRegions([block([line('ⲁ', { x0: 0, y0: 80, x1: 40, y1: 90 })]),
    block([line('ⲃ', { x0: 60, y0: 10, x1: 90, y1: 20 })])], 100, 100);
  assert.deepEqual(result.regions.map(region => region.text), ['ⲁ', 'ⲃ']);
});

test('dense pages split into short requests and report omitted regions', () => {
  const result = textRegions([block(Array.from({ length: 110 }, () => line('ⲡ'.repeat(200))))], 100, 100);
  assert.equal(result.regions.length, MAX_REGIONS);
  assert.ok(result.omitted > 0);
  assert.ok(result.regions.every(region => region.text.length <= 600));
});

test('empty recognition does not invent text', () => {
  assert.deepEqual(textRegions(null, 100, 100), { regions: [], omitted: 0 });
  assert.deepEqual(textRegions([block([line('English only')])], 100, 100), { regions: [], omitted: 0 });
});

test('crop gestures work in either direction and stay inside the photo', () => {
  const box = cropBox({ x: .8, y: .9 }, { x: -.1, y: 1.2 });
  assert.equal(box.x, 0); assert.equal(box.y, .9); assert.equal(box.width, .8);
  assert.ok(Math.abs(box.height - .1) < 1e-12);
});
