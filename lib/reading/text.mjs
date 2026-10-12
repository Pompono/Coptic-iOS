export function wordKey(text) {
  return String(text ?? '').normalize('NFC').toLowerCase().trim();
}
export function withoutMarks(text) {
  return wordKey(text).normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}
export function passageTokens(text) {
  return String(text).split(/([\p{L}\p{M}]+(?:[-=][\p{L}\p{M}]+)*)/u)
    .filter(Boolean).map((text, index) => ({ text, id: index, word: /[\u2c80-\u2cff\u03e2-\u03ef]/u.test(text) }));
}

export function makeWordIndex(entries) {
  const exact = new Map();
  const unmarked = new Map();
  for (const entry of entries) {
    // Dictionary forms sometimes contain prose ("pl. ...", "sg as pl.").
    // Index only actual word forms; retain the original forms for display.
    for (const form of new Set([entry.lemma, ...entry.forms])) {
      const writtenForm = form.replace(/^(?:pl\.|sg\.)\s+/u, '');
      if (!/^[\p{L}\p{M}]+[-=]?$/u.test(writtenForm)) continue;
      const key = wordKey(writtenForm.replace(/[-=]$/, ''));
      for (const [map, lookup] of [[exact, key], [unmarked, withoutMarks(key)]]) {
        const list = map.get(lookup) ?? [];
        if (!list.some(item => item.id === entry.id)) list.push(entry);
        map.set(lookup, list);
      }
    }
  }
  return { exact, unmarked };
}

export function lookupWord(index, word, bohairicOnly = true) {
  const filter = entries => entries.filter(entry => !bohairicOnly || entry.dialect === 'bohairic');
  const exact = filter(index.exact.get(wordKey(word)) ?? []);
  const matches = exact.length ? exact : filter(index.unmarked.get(withoutMarks(word)) ?? []);
  const prefixes = [{ text: 'ⲡⲓ', meaning: 'the (masculine singular)' },
    { text: 'ϯ', meaning: 'the (feminine singular)' }, { text: 'ⲛⲓ', meaning: 'the (plural)' }];
  const analyses = [];
  for (const prefix of prefixes) {
    const plain = withoutMarks(word);
    if (!plain.startsWith(prefix.text)) continue;
    const stem = plain.slice(prefix.text.length);
    if (stem.length < 2) continue;
    const nouns = filter(index.unmarked.get(stem) ?? []).filter(entry => {
      if (entry.dialect !== 'bohairic' || !(/noun/i.test(entry.pos ?? '') || entry.gloss.some(gloss => /^m\. Water/u.test(gloss)))) return false;
      const masculine = /masculine/i.test(entry.pos ?? '') || /^m\./u.test(entry.gloss[0] ?? '');
      const feminine = /feminine/i.test(entry.pos ?? '');
      if (prefix.text === 'ϯ' && masculine && !feminine) return false;
      if (prefix.text === 'ⲡⲓ' && feminine && !masculine) return false;
      return true;
    });
    if (nouns.length) analyses.push({ prefix, stem, entries: nouns });
  }
  return { matches, ignoresMarks: !exact.length && matches.length > 0, analyses };
}
