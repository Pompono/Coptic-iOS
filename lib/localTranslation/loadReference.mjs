// AbortSignal.timeout is unavailable on older supported WebKit versions.
export async function loadReference({ fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl('/reference-translation/bohairic.json', { signal: controller.signal });
    if (!response.ok) throw new Error('The published translation library could not load.');
    const data = await response.json();
    if (data.version !== 1 || !Array.isArray(data.rows)) throw new Error('The published translation library is invalid.');
    return data;
  } finally { clearTimeout(timer); }
}
