export function translationUrl(base, endpoint) {
  if (!['/api/translate', '/api/translate/en-coptic'].includes(endpoint)) throw new Error('Unsupported translation direction.');
  const url = new URL(base?.trim() || 'https://coptlingo.com');
  if (url.protocol !== 'https:') {
    throw new Error('The translation server must use HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Use a translation server origin without credentials, a path, a query, or a fragment.');
  }
  return `${url.href.replace(/\/$/, '')}${endpoint}`;
}
