import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { createTranslationRequest } from './hostedTranslation.mjs';

const request = createTranslationRequest({
  isNative: () => Capacitor.isNativePlatform(),
  nativePost: (options) => CapacitorHttp.post(options),
});

export function translationRequest(endpoint: string, options: RequestInit): Promise<Response> {
  return request(endpoint, options);
}
