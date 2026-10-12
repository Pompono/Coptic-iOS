// Do not guess which letters replace conspicuous OCR artifacts.
export function checkTranslationInput(text) {
  if (/[\d\[\]\u25a1\ufffd]/u.test(text)) {
    throw new Error('Some recognised characters are not Coptic letters (numbers, brackets, or missing-character boxes). Correct the Coptic text before translating this block.');
  }
}
export function checkTranslationOutput(text, source = '') {
  const sourceLetters = source.match(/[\u2c80-\u2cff\u03e2-\u03ef]/gu)?.length || 0;
  const outputLetters = text.match(/[\p{L}]/gu)?.length || 0;
  if (sourceLetters >= 60 && outputLetters < sourceLetters * .25) {
    throw new Error('The model returned only a short fragment of this passage. No complete translation has been accepted. Try shorter complete sentences.');
  }
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  if (sourceLetters >= 60 && words.length <= 3 && words.every(word => /^(alleluia|halleluia|hallelujah|amen)$/.test(word))) {
    throw new Error('The model returned only a refrain from this longer passage. No complete translation has been accepted.');
  }
  const phrases = new Map();
  for (let i = 0; i <= words.length - 5; i++) {
    const phrase = words.slice(i, i + 5).join(' ');
    const count = (phrases.get(phrase) ?? 0) + 1;
    phrases.set(phrase, count);
    if (count >= 3) throw new Error('The local model produced a repetitive, unreliable translation. No English result has been accepted. Check the recognised Coptic and try a shorter passage.');
  }
}
