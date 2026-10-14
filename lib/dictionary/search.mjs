// Port of Bohairic.Core's lookup conventions. Original text is never rewritten.
export const COPTIC_ALPHABET = 'ⲁⲃⲅⲇⲉⲋⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱϣϥϧϩϫϭϯ';
const letters = {
  'ⲁ':['a'], 'ⲃ':['b','v'], 'ⲅ':['g'], 'ⲇ':['d'], 'ⲉ':['e'], 'ⲋ':['so','6'],
  'ⲍ':['z'], 'ⲏ':['e','i','ee'], 'ⲑ':['th'], 'ⲓ':['i','y'], 'ⲕ':['k'], 'ⲗ':['l'],
  'ⲙ':['m'], 'ⲛ':['n'], 'ⲝ':['x','ks'], 'ⲟ':['o'], 'ⲡ':['p'], 'ⲣ':['r'],
  'ⲥ':['s'], 'ⲧ':['t'], 'ⲩ':['u','y'], 'ⲫ':['ph','f'], 'ⲭ':['ch','kh'],
  'ⲯ':['ps'], 'ⲱ':['o','oo'], 'ϣ':['sh'], 'ϥ':['f'], 'ϧ':['kh','x'],
  'ϩ':['h'], 'ϫ':['j','dj'], 'ϭ':['ch','tsh'], 'ϯ':['ti','tee'],
};
export function normalizeSearch(text, ignoreMarks = true) {
  let value = (text ?? '').normalize('NFKD').toLowerCase();
  if (ignoreMarks) value = value.replace(/\p{M}/gu, '');
  return value.replace(/\s+/gu, ' ').trim().normalize('NFC');
}
const tokens = text => [...new Set(text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [])];
const meaning = text => normalizeSearch(text).replace(/^(?:(?:vt|vi|vb|v|n|m|f|adj|adv)\.\s*|to\s+)+/u, '').replace(/^[ .!?"']+|[ .!?"']+$/gu, '');
const hasCoptic = text => /[\u2c80-\u2cff\u03e2-\u03ef]/u.test(text);
const isLatinQuery = text => /[a-z]/u.test(text) && /^[a-z =6-]+$/u.test(text);
export function alphabetKey(text) {
  return Array.from(normalizeSearch(text), ch => {
    const position = COPTIC_ALPHABET.indexOf(ch);
    return position < 0 ? ch : String.fromCharCode(0x100 + position);
  }).join('');
}
export function transliterationIndex(text) {
  return Array.from(normalizeSearch(text), ch => letters[ch] ?? [ch]);
}
export function transliterationMatch(form, query) {
  if (!isLatinQuery(query)) return -1;
  let offsets = new Set([0]), prefix = false;
  for (const aliases of form) {
    const next = new Set();
    for (const offset of offsets) for (const alias of aliases) {
      const remaining = query.length - offset;
      if (remaining < alias.length && alias.startsWith(query.slice(offset))) prefix = true;
      if (remaining >= alias.length && query.slice(offset, offset + alias.length) === alias) next.add(offset + alias.length);
    }
    offsets = next;
    if (!offsets.size) break;
  }
  return offsets.has(query.length) ? 0 : prefix ? 1 : -1;
}
export function indexSearchEntry(entry) {
  const forms = [...new Set([entry.lemma, ...(entry.forms ?? [])])];
  const gloss = (entry.gloss ?? []).join(' • ');
  const metadata = [entry.crum ?? '', entry.etymology ?? '', entry.greek ?? '', entry.tag ?? ''].filter(Boolean).join(' · ');
  return {
    entry, forms, word: normalizeSearch(entry.lemma, false), foldedWord: normalizeSearch(entry.lemma),
    strictForms: forms.map(f => normalizeSearch(f, false)), foldedForms: forms.map(f => normalizeSearch(f)),
    gloss: normalizeSearch(gloss, false), foldedGloss: normalizeSearch(gloss),
    metadata, strictMetadata: normalizeSearch(metadata, false), foldedMetadata: normalizeSearch(metadata),
    meanings: (entry.gloss ?? []).flatMap(g => g.split(/[,;\n]/u)).map(meaning), tokens: tokens(normalizeSearch(gloss)),
    crossReference: (entry.pos ?? '').toLowerCase() === 'cross-reference' || (entry.gloss?.length > 0 && entry.gloss.every(g => /^see:/iu.test(g))),
    latinForms: forms.map(transliterationIndex), sortKey: alphabetKey(entry.lemma),
  };
}
function formMatch(form, query, prefix, ignoreMarks) {
  let at = form.indexOf(query);
  while (at >= 0) {
    if (prefix && at !== 0) return false;
    const end = at + query.length;
    if (ignoreMarks || end === form.length || !/\p{M}/u.test(form[end])) return true;
    if (prefix) return false;
    at = form.indexOf(query, at + 1);
  }
  return false;
}
function allowed(item, options) {
  return (!options.bohairicOnly || item.entry.dialect === 'boh') &&
    (!options.pos || item.entry.pos === options.pos) &&
    (!options.examplesOnly || item.entry.examples?.length > 0) &&
    (!options.initial || item.foldedWord.startsWith(normalizeSearch(options.initial)));
}
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
/** @param {ReturnType<typeof indexSearchEntry>[]} index */
export function searchDictionary(index, options = {}) {
  const { query: raw = '', scope = 'all', ignoreMarks = true } = options;
  const query = normalizeSearch(raw, ignoreMarks), exact = normalizeSearch(raw, false);
  const english = meaning(query), queryTokens = tokens(english);
  const latinQuery = normalizeSearch(query), useLatin = ['all','transliteration'].includes(scope) && isLatinQuery(latinQuery);
  const results = [];
  for (const item of index) {
    if (!allowed(item, options)) continue;
    const word = ignoreMarks ? item.foldedWord : item.word;
    const forms = ignoreMarks ? item.foldedForms : item.strictForms;
    const gloss = ignoreMarks ? item.foldedGloss : item.gloss;
    const metadata = ignoreMarks ? item.foldedMetadata : item.strictMetadata;
    let rank = !query ? 0 : ['english','transliteration'].includes(scope) ? -1
      : item.word === exact ? 0 : word === query ? 1 : forms.includes(query) ? 2
      : formMatch(word, query, true, ignoreMarks) ? 3
      : forms.some(f => formMatch(f, query, true, ignoreMarks)) ? 4
      : forms.some(f => formMatch(f, query, false, ignoreMarks)) ? 5 : -1;
    let label = !query ? '' : ['Headword · exact','Headword · exact','Variant · exact','Headword · starts with','Variant or headword · starts with','Variant or headword · contains'][rank] ?? '';
    let evidence = [2,4,5].includes(rank) ? item.forms.find((f, i) => f !== item.entry.lemma && formMatch(forms[i], query, false, ignoreMarks)) ?? '' : '';
    if (rank < 0 && ['all','english'].includes(scope)) {
      rank = !hasCoptic(query) && item.meanings.includes(english) ? 10
        : !hasCoptic(query) && queryTokens.length && queryTokens.every(t => item.tokens.includes(t)) ? (gloss.includes(query) ? 11 : 12)
        : gloss.includes(query) ? 14 : scope === 'all' && metadata.includes(query) ? 16 : -1;
      label = rank === 10 ? 'English meaning · exact' : [11,12].includes(rank) ? 'Definition · whole words' : rank === 14 ? 'Definition · contains' : rank === 16 ? 'Reference or etymology' : '';
      if (rank === 16) evidence = item.metadata;
      if (rank >= 0 && item.crossReference) rank += 4;
    }
    if (useLatin && (rank < 0 || rank > 13)) {
      item.latinForms.forEach((f, i) => {
        const match = transliterationMatch(f, latinQuery), latinRank = match === 0 ? 13 : 17;
        if (match < 0 || (rank >= 0 && rank <= latinRank)) return;
        rank = latinRank;
        label = match === 0 ? 'Transliteration · approximate spelling' : 'Transliteration · starts with (approximate)';
        evidence = item.forms[i];
      });
    }
    if (rank >= 0) results.push({ ...item.entry, matchRank: rank, matchLabel: label, matchEvidence: evidence, sortKey: item.sortKey });
  }
  return results.sort((a, b) => a.matchRank - b.matchRank || Number(b.dialect === 'boh') - Number(a.dialect === 'boh') || compare(a.sortKey, b.sortKey) || compare(a.lemma, b.lemma) || compare(a.pos ?? '', b.pos ?? ''));
}
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+Number(a[i-1] !== b[j-1]));
    if (i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1]) d[i][j] = Math.min(d[i][j], d[i-2][j-2]+1);
  }
  return d[a.length][b.length];
}
export function suggestDictionary(index, options = {}) {
  const query = normalizeSearch(options.query ?? '', options.ignoreMarks ?? true), coptic = hasCoptic(query);
  if (options.scope === 'transliteration' || query.length < 3 || query.length > 48 || query.includes(' ') ||
      (coptic && options.scope === 'english') || (!coptic && options.scope === 'coptic')) return [];
  const limit = query.length >= 6 ? 2 : 1, candidates = new Map(), seen = new Set();
  for (const item of index) {
    if (!allowed(item, options)) continue;
    for (const value of coptic ? (options.ignoreMarks === false ? item.strictForms : item.foldedForms) : item.tokens) {
      if (seen.has(value) || value.length < 3 || Math.abs(query.length - value.length) > limit) continue;
      seen.add(value);
      const distance = editDistance(query, value);
      if (distance > 0 && distance <= limit) candidates.set(value, distance);
    }
  }
  return [...candidates].sort((a, b) => a[1] - b[1] || Math.abs(a[0].length-query.length)-Math.abs(b[0].length-query.length) || compare(a[0], b[0])).slice(0, 3).map(([word]) => word);
}
export function crossReferences(entry, index) {
  return [...new Set((entry.gloss ?? []).flatMap(sense => {
    const match = sense.match(/\bSee:\s*(?:\(\d+\))?\s*([\u2c80-\u2cff\u03e2-\u03ef\p{M}]+(?:[-=])?)/iu);
    if (!match) return [];
    const target = normalizeSearch(match[1]);
    // Use the parent's headword when the source refers to a variant.
    const parent = index.find(item => item.foldedForms.includes(target));
    return parent ? [parent.entry.lemma] : [];
  }))];
}
