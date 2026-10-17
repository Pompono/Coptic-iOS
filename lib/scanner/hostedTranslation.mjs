import { MAX_TRANSLATION_CHARACTERS } from '../hostedTranslation.mjs';
import { checkTranslationInput, checkTranslationOutput } from '../localTranslation/quality.mjs';

// Preserve every code point and split only between words/sentences. A single
// oversized token requires user correction, never an arbitrary cut or truncation.
export function splitScannerText(input, limit = MAX_TRANSLATION_CHARACTERS) {
  const points = Array.from(input.trim());
  const parts = [];
  while (points.length) {
    if (points.length <= limit) { parts.push(points.join('')); break; }
    let end = limit;
    while (end > 0 && (!/[\s.!?;:·…]/u.test(points[end - 1]) || /\p{M}/u.test(points[end]))) end--;
    if (!end) throw new Error('A word or unbroken passage exceeds 1,200 characters. Add an appropriate word or sentence boundary before sending. Nothing has been truncated.');
    parts.push(points.splice(0, end).join(''));
  }
  return parts;
}

export function planScannerTranslation(blocks, dialect) {
  if (!['bohairic', 'sahidic'].includes(dialect)) throw new Error('Choose a scanner dialect.');
  const planned = blocks.filter(block => block.text.trim()).map(block => {
    checkTranslationInput(block.text);
    return Object.freeze({ id: block.id, text: block.text, parts: Object.freeze(splitScannerText(block.text)) });
  });
  // Only approved textual fields enter the plan. No photo, boxes, OCR metadata,
  // or mutable region objects can reach the transport through it.
  return Object.freeze({ dialect, blocks: Object.freeze(planned) });
}

function checkCancelled(signal) {
  if (signal?.aborted) throw new Error('Translation was stopped. Completed parts are kept.');
}

export function waitForScanner(ms, signal) {
  checkCancelled(signal);
  return new Promise((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(new Error('Translation was stopped. Completed parts are kept.')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

export function scannerRetryDelay(header, now = Date.now()) {
  const seconds = header?.trim() ? Number(header) : NaN;
  const value = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header || '') - now;
  return Math.max(60000, Number.isFinite(value) ? Math.min(value, 86400000) : 60000);
}

export function createScannerTranslator({ request, now = Date.now, wait = waitForScanner, paceMs = 2500 }) {
  const cache = new Map();
  let nextStart = 0;
  let cooldown = 0;
  let running = false;
  return {
    clear() { cache.clear(); }, // Keep pacing/cooldown across photo changes.
    async run(plan, { approved, signal, onBlock = (_result) => {}, onProgress = (_message) => {} }) {
      if (approved !== true) throw new Error('Review and approve the text before sending it.');
      if (running) throw new Error('A scanner translation is still finishing.');
      running = true;
      try {
        for (const [blockIndex, block] of plan.blocks.entries()) {
          checkCancelled(signal);
          const key = JSON.stringify([plan.dialect, block.text]);
          let translations = cache.get(key);
          if (!translations) { translations = []; cache.set(key, translations); }
          for (let part = translations.length; part < block.parts.length; part++) {
            checkCancelled(signal);
            const delay = Math.max(nextStart, cooldown) - now();
            if (delay > 0) {
              onProgress(`Waiting ${Math.ceil(delay / 1000)} seconds before the next request. You can stop.`);
              await wait(delay, signal);
            }
            checkCancelled(signal);
            onProgress(`Translating block ${blockIndex + 1} of ${plan.blocks.length}, part ${part + 1} of ${block.parts.length}…`);
            nextStart = now() + Math.max(2500, paceMs);
            const response = await request('/api/translate', {
              method: 'POST', signal,
              body: JSON.stringify({ text: block.parts[part], dialect: plan.dialect, includeConfidence: false }),
            });
            checkCancelled(signal);
            if (response.status === 429) {
              const delay = scannerRetryDelay(response.headers.get('Retry-After'), now());
              cooldown = now() + delay;
              throw new Error(`Translation paused by the server. Wait at least ${Math.ceil(delay / 1000)} seconds, then review and send the remaining text again. Completed parts are kept; no automatic retry was made.`);
            }
            const result = await response.json();
            checkCancelled(signal);
            if (!response.ok) throw new Error(result.error || 'Translation service is unavailable.');
            if (typeof result.translation !== 'string' || !result.translation.trim()) throw new Error('Translation service returned an invalid response.');
            checkTranslationOutput(result.translation, block.parts[part]);
            translations.push(result.translation);
            onBlock({ id: block.id, text: block.text, translation: translations.join('\n\n'),
              complete: translations.length === block.parts.length, completedParts: translations.length, totalParts: block.parts.length });
          }
          checkCancelled(signal);
          onBlock({ id: block.id, text: block.text, translation: translations.join('\n\n'), complete: true,
            completedParts: translations.length, totalParts: block.parts.length });
        }
      } finally { running = false; }
    },
  };
}
