export function translationUrl(base, endpoint) {
  if (!base?.trim()) {
    throw new Error('Translation is not configured yet. Lessons and dictionary work offline.');
  }
  const url = new URL(base);
  if (url.protocol !== 'https:') {
    throw new Error('The translation server must use HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Use a translation server URL without credentials, a query, or a fragment.');
  }
  return `${url.href.replace(/\/$/, '')}${endpoint}`;
}
