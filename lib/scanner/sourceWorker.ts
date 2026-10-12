import { makeReferenceIndex } from '../localTranslation/reference.mjs';
import { suggestionEntries, suggestSources } from './sourceSuggestions.mjs';
let entries: Promise<ReturnType<typeof suggestionEntries>> | null = null;
self.onmessage = async ({ data }) => {
  try {
    entries ??= fetch('/reference-translation/bohairic.json', { signal: AbortSignal.timeout(15000) }).then(async response => {
      if (!response.ok) throw new Error('Published passages could not load.');
      const data = await response.json();
      return suggestionEntries(makeReferenceIndex(data.rows, data.selectedRows || []));
    }).catch(error => { entries = null; throw error; });
    self.postMessage({ id: data.id, suggestions: suggestSources(await entries, data.text) });
  } catch (error) { self.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Source search failed.' }); }
};
