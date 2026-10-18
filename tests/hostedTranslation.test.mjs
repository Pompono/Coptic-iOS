import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTranslationRequest } from '../lib/hostedTranslation.mjs';

const options = (text = 'sample', extra = {}) => ({ body: JSON.stringify({ text, dialect: 'bohairic', includeConfidence: true }), ...extra });
for (const native of [true, false]) {
  for (const endpoint of ['/api/translate', '/api/translate/en-coptic']) {
    test(`${native ? 'native HTTP' : 'browser'}: ${endpoint} uses public proxy and preserves options`, async () => {
      let calls = 0;
      const inspect = (url, data, headers) => {
        calls++;
        assert.equal(url, `https://coptlingo.com${endpoint}`);
        assert.deepEqual(data, { text: 'sample', dialect: 'bohairic', includeConfidence: true });
        assert.deepEqual(headers, { 'Content-Type': 'application/json' });
      };
      const payload = { translation: 'translated', dialect: 'bohairic', confidence: 0.8 };
      const request = createTranslationRequest({ isNative: () => native,
        nativePost: async (o) => {
          assert.equal(native, true);
          inspect(o.url, o.data, o.headers);
          assert.equal(o.disableRedirects, true);
          assert.equal(o.connectTimeout, 30000);
          assert.equal(o.readTimeout, 30000);
          return { status: 200, data: payload };
        },
        fetchImpl: async (url, o) => {
          assert.equal(native, false);
          inspect(url, JSON.parse(o.body), o.headers);
          assert.equal(o.redirect, 'error');
          assert.ok(o.signal instanceof AbortSignal);
          return Response.json(payload);
        },
      });
      const result = await request(endpoint, options(' sample '));
      assert.equal(result.status, 200);
      assert.deepEqual(await result.json(), payload);
      assert.equal(calls, 1);
    });
  }
}

test('validates the Unicode boundary before sending anything, in both directions', async () => {
  let calls = 0;
  const request = createTranslationRequest({ isNative: () => false, fetchImpl: async () => { calls++; return Response.json({ translation: 'ok' }); } });
  for (const endpoint of ['/api/translate', '/api/translate/en-coptic']) {
    await request(endpoint, options('ⲁ'.repeat(1200)));
    await request(endpoint, options('😀'.repeat(1200)));
    await assert.rejects(request(endpoint, options('ⲁ'.repeat(1201))), /1,200/);
  }
  assert.equal(calls, 4);
});

test('offline AI fails clearly without using a network or local-model fallback', async () => {
  const request = createTranslationRequest({ isNative: () => true, isOnline: () => false, nativePost: () => assert.fail('must stay offline') });
  await assert.rejects(request('/api/translate', options()), /Published text.*offline/);
});

test('Sahidic, omitted options, and extra input fields use the website contract only', async () => {
  const bodies = [];
  const request = createTranslationRequest({ isNative: () => true, nativePost: async (o) => {
    bodies.push(o.data);
    assert.deepEqual(o.headers, { 'Content-Type': 'application/json' });
    return { status: 200, data: { translation: 'ok' } };
  } });
  await request('/api/translate', { body: JSON.stringify({ text: 'sample', dialect: 'sahidic', image: 'must-not-send', method: 'published' }), headers: { 'X-API-Key': 'test-only-not-sent' } });
  await request('/api/translate/en-coptic', { body: JSON.stringify({ text: 'sample' }) });
  assert.deepEqual(bodies, [
    { text: 'sample', dialect: 'sahidic', includeConfidence: false },
    { text: 'sample', dialect: 'bohairic', includeConfidence: false },
  ]);
});

for (const status of [401, 403, 429, 500, 502, 503, 504]) {
  test(`handles HTTP ${status} without retries or raw upstream diagnostics`, async () => {
    let calls = 0;
    const request = createTranslationRequest({ isNative: () => true, nativePost: async () => {
      calls++; return { status, data: { error: 'sensitive diagnostic' } };
    } });
    const response = await request('/api/translate', options());
    assert.equal(response.status, status);
    const body = await response.json();
    assert.match(body.error, status === 429 ? /wait a minute/ : status === 504 ? /timed out/ : /unavailable/);
    assert.doesNotMatch(body.error, /sensitive/);
    assert.equal(calls, 1);
  });
}

test('native timeout bounds waiting, prevents duplicate requests, and permits recovery', async () => {
  let complete;
  let calls = 0;
  const request = createTranslationRequest({ isNative: () => true, timeoutMs: 15, nativePost: () => {
    calls++; return new Promise(resolve => { complete = resolve; });
  } });
  await assert.rejects(request('/api/translate', options()), /timed out/);
  await assert.rejects(request('/api/translate', options()), /still finishing/);
  assert.equal(calls, 1);
  complete({ status: 200, data: { translation: 'late' } });
  await new Promise(resolve => setTimeout(resolve, 0));
  const next = request('/api/translate', options());
  complete({ status: 200, data: JSON.stringify({ translation: 'recovered' }) });
  assert.equal((await (await next).json()).translation, 'recovered');
});

for (const native of [true, false]) {
  test(`${native ? 'native' : 'browser'} interruption ignores late responses`, async () => {
    const controller = new AbortController();
    const request = createTranslationRequest({ isNative: () => native,
      nativePost: () => new Promise(() => {}), fetchImpl: () => new Promise(() => {}),
    });
    const result = request('/api/translate', options('sample', { signal: controller.signal }));
    controller.abort();
    await assert.rejects(result, /cancelled/);
  });
}

test('invalid replies and native network errors are safe', async () => {
  for (const data of [{}, '<html>failure</html>']) {
    const request = createTranslationRequest({ isNative: () => true, nativePost: async () => ({ status: 200, data }) });
    await assert.rejects(request('/api/translate', options()), /unavailable/);
  }
  const request = createTranslationRequest({ isNative: () => true, nativePost: async () => { throw { message: 'network internals' }; } });
  await assert.rejects(request('/api/translate', options()), /unavailable/);
});

test('Translator wiring never imports local inference or frontend API credentials', async () => {
  const service = await readFile('lib/translationService.ts', 'utf8');
  assert.match(service, /CapacitorHttp.post/);
  assert.doesNotMatch(service, /localTranslation|process.env|API_KEY/);
  const screen = await readFile('app/translator/page.tsx', 'utf8');
  assert.match(screen, /publishedTranslation\(text, translatorDialect\)/);
  assert.doesNotMatch(screen, /translateLocally|hasLocalTranslator|localTranslation\/client/);
  assert.match(screen, /method: "experimental"/);
});
