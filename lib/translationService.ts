import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { translationUrl } from './translationUrl.mjs';
import { hasLocalTranslator, translateLocally } from './localTranslation/client';

export async function translationRequest(endpoint: string, options: RequestInit): Promise<Response> {
  if (endpoint === '/api/translate' && await hasLocalTranslator()) {
    const { text, dialect = 'bohairic', method = 'published' } = JSON.parse(String(options.body));
    const result = await translateLocally(text, dialect, method);
    return new Response(JSON.stringify(result), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
  const url = translationUrl(process.env.NEXT_PUBLIC_TRANSLATION_API_URL, endpoint);
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Connect to the internet to translate. Lessons and dictionary work offline.');
  }
  if (Capacitor.isNativePlatform()) {
    const result = await CapacitorHttp.post({
      url,
      headers: { 'Content-Type': 'application/json' },
      data: JSON.parse(String(options.body)),
      connectTimeout: 15000,
      readTimeout: 120000,
    });
    return new Response(JSON.stringify(result.data), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return fetch(url, { ...options, signal: AbortSignal.timeout(120000) });
}
