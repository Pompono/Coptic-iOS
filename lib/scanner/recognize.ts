import { textRegions } from './regions.mjs';
import type { ScanImage } from './images';

export type ScanRegion = {
  id: string; text: string; confidence: number;
  box: { x: number; y: number; width: number; height: number };
  translation?: string; error?: string;
};

// Use the pinned Tesseract.js 6 worker protocol directly. Its createWorker()
// exposes the underlying worker only after initialization; owning it from the
// start lets Stop, navigation, startup errors, and timeouts release it immediately.
export function recognizePhoto(image: ScanImage, onProgress: (message: string) => void) {
  let worker: globalThis.Worker;
  try { worker = new globalThis.Worker('/ocr/worker.min.js'); }
  catch { return { cancel() {}, result: Promise.reject(new Error('Photo recognition is unavailable in this browser.')) }; }
  let stopped = false;
  let sequence = 0;
  let pending: { id: string; resolve: (value: any) => void; reject: (error: Error) => void } | null = null;
  function cancel(message = 'Recognition was cancelled.') {
    stopped = true;
    worker.terminate();
    pending?.reject(new Error(message));
    pending = null;
  }
  function request(action: string, payload: object) {
    if (stopped) return Promise.reject(new Error('Recognition was cancelled.'));
    return new Promise<any>((resolve, reject) => {
      const jobId = `scan-${++sequence}`;
      pending = { id: jobId, resolve, reject };
      worker.postMessage({ workerId: 'coptic-scanner', jobId, action, payload });
    });
  }
  worker.onmessage = ({ data }) => {
    if (stopped) return;
    if (data.status === 'progress') {
      onProgress(data.data.status === 'recognizing text'
        ? `Reading Coptic… ${Math.round(data.data.progress * 100)}%` : 'Preparing Coptic recognition…');
      return;
    }
    if (data.jobId !== pending?.id) return;
    const job = pending;
    pending = null;
    if (data.status === 'reject') job.reject(new Error(`Coptic recognition failed. ${String(data.data)}`));
    else job.resolve(data.data);
  };
  worker.onerror = event => {
    event.preventDefault();
    cancel('Coptic recognition could not start. Close and reopen the app, then try a smaller photo.');
  };
  const timer = setTimeout(() => cancel('Recognition took too long. Crop a smaller area and try again.'), 120000);
  const result = (async () => {
    try {
      const assetPath = new URL('/ocr', window.location.href).href;
      await request('load', { options: { lstmOnly: true, corePath: assetPath, logging: false } });
      await request('loadLanguage', { langs: 'cop', options: { langPath: assetPath, gzip: false, cacheMethod: 'none', lstmOnly: true } });
      await request('initialize', { langs: 'cop', oem: 1, config: {} });
      await request('setParameters', { params: { tessedit_pageseg_mode: '3', preserve_interword_spaces: '1' } });
      const bytes = Uint8Array.from(atob(image.url.split(',')[1]), character => character.charCodeAt(0));
      const data = await request('recognize', { image: bytes, options: {}, output: { text: true, blocks: true } });
      return textRegions(data.blocks, image.width, image.height) as { regions: ScanRegion[]; omitted: number };
    } finally {
      clearTimeout(timer);
      stopped = true;
      worker.terminate();
    }
  })();
  return { cancel, result };
}
