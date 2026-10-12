const abbreviations = new Map([
  ['ⲫϯ', 'ⲫⲛⲟⲩϯ'], ['ⲙⲫϯ', 'ⲙⲫⲛⲟⲩϯ'], ['ⲡⲭⲥ', 'ⲡⲭⲣⲓⲥⲧⲟⲥ'], ['ⲭⲥ', 'ⲭⲣⲓⲥⲧⲟⲥ'], ['ⲓⲏⲥ', 'ⲓⲏⲥⲟⲩⲥ'],
]);
// The source corpus omits combining marks and has inconsistent spacing.
// Retain every base letter: never fix letters, delete OCR artifacts, or use
// fuzzy similarity to accept an English translation.
export function referenceKey(text) {
  if (/[\d\[\]\u25a1\ufffd]/u.test(String(text))) return null;
  let value = String(text).normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, '');
  value = value.replace(/[\u2c80-\u2cff\u03e2-\u03ef]+/gu, word => abbreviations.get(word) ?? word);
  value = value.replace(/[\s\p{P}]/gu, '');
  if (!value || /[^\u2c80-\u2cff\u03e2-\u03ef]/u.test(value)) return null;
  return value;
}
export function makeReferenceIndex(rows, selectedRows = []) {
  const index = new Map();
  for (const row of rows) {
    const key = referenceKey(row[0]);
    if (!key || key.length < 25) continue;
    if (!index.has(key)) index.set(key, row);
    else if (index.get(key) && index.get(key)[1].trim() !== row[1].trim()) index.set(key, null);
  }
  // Explicitly selected source renderings can resolve known version variants.
  // No similarity heuristic or majority vote selects a conflicting translation.
  for (const [file, line] of selectedRows) {
    const row = rows.find(row => row[2] === file && row[3] === line);
    if (row) { const key = referenceKey(row[0]); if (key && key.length >= 25) index.set(key, row); }
  }
  return index;
}
export function matchReference(index, text, dialect) {
  if (dialect !== 'bohairic') return null;
  const key = referenceKey(text);
  if (!key) return null;
  const row = index.get(key);
  if (!row) return null;
  return { translation: row[1], dialect, method: 'published', matchedText: row[0],
    source: 'Coptic Corpora / Tasbeha (CC-BY-4.0)',
    sourceUrl: 'https://huggingface.co/datasets/megalaa/coptic-corpora',
    sourceRow: `${row[2]}:${row[3]}` };
}
