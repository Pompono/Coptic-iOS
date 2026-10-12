import { referenceKey } from '../localTranslation/reference.mjs';
// Search is permissive only to propose text for review. Exact translation
// matching remains separate and never uses these scores.
export function searchKey(text) {
  const strict = referenceKey(text);
  if (strict) return strict;
  const cleaned = String(text).normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\u2c80-\u2cff\u03e2-\u03ef\s]/gu, ' ');
  return referenceKey(cleaned) || '';
}
function grams(text) {
  const result = new Set();
  for (let i = 0; i < text.length - 2; i++) result.add(text.slice(i, i + 3));
  return result;
}
export function suggestionEntries(index) {
  return [...index.entries()].filter(([, row]) => row).map(([key, row]) => ({ key, row, grams: grams(key) }));
}
export function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, previous[j + 1] + 1, previous[j] + (a[i] === b[j] ? 0 : 1)));
    previous = next;
  }
  return previous[b.length];
}
export function suggestSources(entries, text, limit = 3) {
  const key = searchKey(text);
  if (key.length < 16 || key.length > 1200) return [];
  const strictKey = referenceKey(text);
  if (strictKey && entries.some(entry => entry.key === strictKey)) return [];
  const queryGrams = grams(key);
  const shortlist = [];
  for (const entry of entries) {
    if (entry.key.length > key.length * 2 || entry.key.length < key.length * .5) continue;
    let overlap = 0;
    for (const gram of queryGrams) if (entry.grams.has(gram)) overlap++;
    const similarity = 2 * overlap / (queryGrams.size + entry.grams.size);
    if (similarity >= .25) shortlist.push({ entry, similarity });
  }
  shortlist.sort((a, b) => b.similarity - a.similarity);
  return shortlist.slice(0, 40).map(({ entry }) => {
    const distance = editDistance(key, entry.key);
    return { text: entry.row[0], sourceRow: `${entry.row[2]}:${entry.row[3]}`, distance,
      similarity: 1 - distance / Math.max(key.length, entry.key.length) };
  }).filter(item => item.similarity >= .55 && (item.distance > 0 || !strictKey))
    .sort((a, b) => b.similarity - a.similarity || a.distance - b.distance).slice(0, limit);
}
// Align characters for review, retaining spaces, punctuation and all marks.
export function characterDiff(original, proposed) {
  const a = Array.from(original), b = Array.from(proposed);
  if (a.length > 1200 || b.length > 1200) return [];
  const matrix = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  const output = []; let i = a.length, j = b.length;
  while (i || j) {
    if (i && j && matrix[i][j] === matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      output.push({ before: a[--i], after: b[--j], changed: a[i] !== b[j] });
    } else if (j && matrix[i][j] === matrix[i][j - 1] + 1) output.push({ before: '', after: b[--j], changed: true });
    else output.push({ before: a[--i], after: '', changed: true });
  }
  return output.reverse();
}
