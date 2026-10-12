import test from 'node:test';
import assert from 'node:assert/strict';
import { improveContrast } from '../lib/scanner/contrast.mjs';
const pixels = values => new Uint8ClampedArray(values.flatMap(value => [value, value, value, 255]));
test('bright glyphs on a dark page become dark glyphs on a light page without editing the source', () => {
 const input = pixels([...Array(90).fill(40), ...Array(10).fill(210)]), original = input.slice();
 const result = improveContrast(input);
 assert.deepEqual(input, original);
 assert.equal(result.length, input.length);
 assert.ok(result[0] > 230);
 assert.ok(result[90 * 4] < 30);
 assert.equal(result[3], 255);
});
test('keeps dark print on paper dark and retains intermediate antialias shades', () => {
 const result = improveContrast(pixels([...Array(90).fill(220), 80, ...Array(9).fill(20)]));
 assert.ok(result[0] > 230);
 assert.ok(result[91 * 4] < 30);
 assert.ok(result[90 * 4] > 30 && result[90 * 4] < 220);
});
