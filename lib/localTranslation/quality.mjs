// Do not guess which letters replace conspicuous OCR artifacts.
export function checkTranslationInput(text) {
  if (/[\d\[\]\u25a1\ufffd]/u.test(text)) {
    throw new Error('Some recognised characters are not Coptic letters (numbers, brackets, or missing-character boxes). Correct the Coptic text before translating this block.');
  }
}
export function checkTranslationOutput(text) {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  const phrases = new Map();
  for (let i = 0; i <= words.length - 5; i++) {
    const phrase = words.slice(i, i + 5).join(' ');
    const count = (phrases.get(phrase) ?? 0) + 1;
    phrases.set(phrase, count);
    if (count >= 3) throw new Error('The local model produced a repetitive, unreliable translation. No English result has been accepted. Check the recognised Coptic and try a shorter passage.');
  }
}
