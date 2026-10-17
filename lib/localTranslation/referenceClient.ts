import { loadReference } from './loadReference.mjs';
import { makeReferenceIndex, matchReference } from './reference.mjs';
let index: Promise<ReturnType<typeof makeReferenceIndex>> | null = null;
export async function publishedTranslation(text: string, dialect: string) {
  if (dialect !== 'bohairic') return null;
  index ??= loadIndex().catch(error => { index = null; throw error; });
  return matchReference(await index, text, dialect);
}

async function loadIndex() {
  const data = await loadReference();
  return makeReferenceIndex(data.rows, data.selectedRows || []);
}
