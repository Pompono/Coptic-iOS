import { publishedTranslation } from './referenceClient';
export type TranslationMethod = 'published' | 'experimental';
let worker: Worker | null = null;
let sequence = 0;
let active = false;
let cancel: (() => void) | null = null;
let available: Promise<boolean> | null = null;
export function hasLocalTranslator(): Promise<boolean> {
  return available ??= fetch('/models/coptic-english/manifest.json')
    .then(async response => response.ok && (await response.json()).model === 'megalaa/coptic-english-translator')
    .catch(() => false);
}
export async function translateLocally(text: string, dialect: string, method: TranslationMethod = 'published') {
  if (active) throw new Error('Wait for the current translation to finish.');
  active = true;
  const id = ++sequence;
  try {
    const reference = await publishedTranslation(text, dialect);
    if (id !== sequence) throw new Error("Translation was cancelled.");
    if (reference) { active = false; return reference; }
    if (method !== 'experimental') {
      throw new Error(dialect === 'bohairic'
        ? 'No unambiguous published translation matches these letters. Check the scanned Coptic against the photo. Unmatched text has not been translated.'
        : 'Published-text matching currently covers Bohairic. No published Sahidic translation has been returned.');
    }
  } catch (error) { if (id === sequence) active = false; throw error; }

  return new Promise<{ translation: string; dialect: string; method?: string; source?: string; sourceUrl?: string; matchedText?: string; sourceRow?: string }>((resolve, reject) => {
    try { worker ??= new Worker(new URL('./worker.ts', import.meta.url)); }
    catch {
      active = false;
      reject(new Error('On-device translation is unavailable in this browser.'));
      return;
    }
    const timer = setTimeout(() => {
      worker?.terminate(); worker = null; active = false;
      reject(new Error('On-device translation took too long. Try a shorter passage.'));
    }, 180000);
    const finish = () => { clearTimeout(timer); active = false; cancel = null; };
    cancel = () => { finish(); reject(new Error('Translation was cancelled.')); };
    worker.onmessage = event => {
      if (event.data.id !== id) return;
      finish();
      if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data);
    };
    worker.onerror = () => {
      finish(); worker?.terminate(); worker = null;
      reject(new Error('The local translator could not start. Close and reopen the app, then try a shorter passage.'));
    };
    worker.postMessage({ id, text, dialect });
  });
}

export function disposeLocalTranslator() {
  sequence++;
  active = false;
  cancel?.();
  worker?.terminate();
  worker = null;
}
