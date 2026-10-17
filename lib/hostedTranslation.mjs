import { translationUrl } from './translationUrl.mjs';

export const MAX_TRANSLATION_CHARACTERS = 1200;
const OFFLINE = 'AI translation needs an internet connection. Published text, lessons, and dictionary work offline.';
const UNAVAILABLE = 'Translation service is unavailable. Check your connection and try again later.';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const TIMEOUT = 'Translation timed out. Try a shorter passage or try again later.';

// Injectable transports let tests exercise native HTTP without a device.
export function createTranslationRequest({ isNative, nativePost, fetchImpl = fetch,
  isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false,
  timeoutMs = 30000 }) {
  let nativePending = false;
  return async function translationRequest(endpoint, options) {
    const url = translationUrl(undefined, endpoint);
    const input = JSON.parse(String(options.body));
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text) throw new Error('Please provide text.');
    if (Array.from(text).length > MAX_TRANSLATION_CHARACTERS) throw new Error('AI translation accepts up to 1,200 characters. Shorten this passage.');
    const dialect = input.dialect ?? (endpoint.endsWith('en-coptic') ? 'bohairic' : 'sahidic');
    if (!['bohairic', 'sahidic'].includes(dialect)) throw new Error('Choose Bohairic or Sahidic.');
    if (!isOnline()) throw new Error(OFFLINE);
    if (options.signal?.aborted) throw new Error('Translation was cancelled.');
    const native = isNative();
    if (native && nativePending) throw new Error('The previous translation is still finishing. Please wait before trying again.');
    const data = { text, dialect, includeConfidence: input.includeConfidence === true };
    const controller = new AbortController();
    let timedOut = false;
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    let onAbort;
    const interrupted = new Promise((_, reject) => {
      onAbort = () => reject(new Error(timedOut ? TIMEOUT : 'Translation was cancelled.'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const task = async () => {
        let response;
        if (native) {
          nativePending = true;
          try {
            // Direct plugin calls bypass browser CORS; no global fetch patch.
            // Capacitor 7 cannot abort native HTTP: retain the guard until the
            // request actually settles, even if its caller stops waiting.
            // Capacitor iOS 7 uses connectTimeout for the whole URLRequest when both
            // values exist. Keep both at 30s to cover the proxy's 25s budget.
            const result = await nativePost({ url, data, headers: { 'Content-Type': 'application/json' },
              connectTimeout: 30000, readTimeout: 30000, disableRedirects: true, responseType: 'json' });
            response = new Response(typeof result.data === 'string' ? result.data : JSON.stringify(result.data), { status: result.status });
          } finally { nativePending = false; }
        } else {
          response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data), signal: controller.signal, redirect: 'error', cache: 'no-store' });
        }
        if (!response.ok) {
          const error = response.status === 429 ? 'Too many translation requests. Please wait a minute before trying again.'
            : response.status === 504 ? TIMEOUT : UNAVAILABLE;
          return json({ error }, response.status);
        }
        const result = await response.json();
        if (typeof result?.translation !== 'string' || !result.translation.trim()) throw new Error(UNAVAILABLE);
        return json({ translation: result.translation, dialect: result.dialect || dialect,
          ...(typeof result.confidence === 'number' && Number.isFinite(result.confidence) ? { confidence: result.confidence } : {}) });
      };
      return await Promise.race([task(), interrupted]);
    } catch (error) {
      if (controller.signal.aborted) throw new Error(timedOut ? TIMEOUT : 'Translation was cancelled.');
      if (!isOnline()) throw new Error(OFFLINE);
      // Native plugins can reject with plain objects. Hide raw diagnostics.
      if (/timed?\s*out|timeout/i.test(String(error?.message || ''))) throw new Error(TIMEOUT);
      throw new Error(UNAVAILABLE);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      controller.signal.removeEventListener('abort', onAbort);
    }
  };
}
