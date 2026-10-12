import { makeReferenceIndex, matchReference } from './reference.mjs';
let index: Promise<ReturnType<typeof makeReferenceIndex>> | null = null;
export async function publishedTranslation(text: string, dialect: string) {
  if (dialect !== 'bohairic') return null;
  index ??= fetch('/reference-translation/bohairic.json', { signal: AbortSignal.timeout(15000) }).then(async response => {
    if (!response.ok) throw new Error('The published translation library could not load.');
    const data = await response.json();
    if (data.version !== 1 || !Array.isArray(data.rows)) throw new Error('The published translation library is invalid.');
    return makeReferenceIndex(data.rows, data.selectedRows || []);
  }).catch(error => { index = null; throw error; });
  return matchReference(await index, text, dialect);
}
