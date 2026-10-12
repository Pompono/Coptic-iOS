import { toEntryFromBohairic, toEntryFromCombined, type DictionaryEntry } from '@/lib/dictionary';
let loading: Promise<DictionaryEntry[]> | null = null;
export function loadReadingDictionary() {
  return loading ??= Promise.all(['/bohairic_dictionary.json', '/coptic_dictionary_combined.json'].map(async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('The bundled dictionary could not be loaded.');
    return response.json();
  })).then(([bohairic, combined]) => [...bohairic.map(toEntryFromBohairic), ...combined.map(toEntryFromCombined)])
    .catch(error => { loading = null; throw error; });
}
