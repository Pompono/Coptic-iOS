import test from 'node:test';
import assert from 'node:assert/strict';
import { splitScannerText, planScannerTranslation, createScannerTranslator, scannerRetryDelay, waitForScanner } from '../lib/scanner/hostedTranslation.mjs';
import { loadReference } from '../lib/localTranslation/loadReference.mjs';
import { readFile } from 'node:fs/promises';

const block = (text, id = 'block-1') => ({ id, text, photo: 'must-never-send', box: { x: 0 } });
const success = (translation = 'translated') => Response.json({ translation });
function harness(request) {
  let time = 0;
  const starts = [];
  const waits = [];
  const queue = createScannerTranslator({ now: () => time,
    wait: async (ms, signal) => { assert.ok(!signal?.aborted); waits.push(ms); time += ms; },
    request: async (endpoint, options) => { starts.push(time); return request(endpoint, options); },
  });
  return { queue, starts, waits };
}

test('splitting preserves all Unicode text, punctuation, spaces and combining marks', () => {
  for (const text of ['ⲁ'.repeat(1200), ('ⲁ̀ ⲃ😀.\n').repeat(700), 'word '.repeat(900), 'ⲁ'.repeat(1198) + ' ⲃ̀ word']) {
    const parts = splitScannerText(text);
    assert.equal(parts.join(''), text.trim());
    for (const part of parts) {
      assert.ok(Array.from(part).length <= 1200);
      assert.ok(!/^\p{M}/u.test(part), 'never split a base letter from its marks');
      assert.ok(part.trim());
    }
  }
});
test('an oversized unbroken word fails before any part can be sent', () => {
  assert.throws(() => splitScannerText('ⲁ'.repeat(1201)), /Nothing has been truncated/);
  assert.throws(() => planScannerTranslation([block('short'), block('ⲁ'.repeat(1201), 'bad')], 'bohairic'), /boundary/);
});
test('scanner refuses conspicuous OCR artifacts before review or transmission', () => {
  for (const text of ['ⲉ 4 ⲙⲁⲣⲓⲁ', '[[ⲑⲟ', 'ⲁ □ ⲛⲁⲛ']) {
    assert.throws(() => planScannerTranslation([block(text)], 'bohairic'), /Correct the Coptic/);
  }
});
test('fragmentary and repetitive hosted output is refused before caching or overlays', async () => {
  for (const translation of ['Halleluia', 'Thou hast born a fifth; '.repeat(4)]) {
    let calls = 0;
    const { queue } = harness(() => { calls++; return success(translation); });
    const plan = planScannerTranslation([block('ⲁⲃ '.repeat(60))], 'bohairic');
    for (let i = 0; i < 2; i++) {
      await assert.rejects(queue.run(plan, { approved: true, onBlock: () => assert.fail('unreliable output must not appear') }), /fragment|refrain|unreliable/);
    }
    assert.equal(calls, 2, 'rejected output never enters the successful resume cache');
  }
});
test('approval plans are immutable snapshots with text only; approval is required', async () => {
  const source = block('ⲁ');
  const plan = planScannerTranslation([source], 'bohairic');
  source.text = 'changed after review';
  assert.deepEqual(plan.blocks[0], { id: 'block-1', text: 'ⲁ', parts: ['ⲁ'] });
  assert.throws(() => plan.blocks[0].parts.push('unapproved'), TypeError);
  const { queue } = harness(() => assert.fail('must not send without approval'));
  await assert.rejects(queue.run(plan, { approved: false }), /approve/);
});
test('sequential, paced requests contain only approved text and dialect', async () => {
  let active = 0;
  const requests = [];
  const { queue, starts } = harness(async (endpoint, options) => {
    assert.equal(active++, 0);
    assert.equal(endpoint, '/api/translate');
    const body = JSON.parse(options.body);
    assert.deepEqual(Object.keys(body).sort(), ['dialect', 'includeConfidence', 'text']);
    assert.equal(body.dialect, 'sahidic');
    assert.equal(body.includeConfidence, false);
    requests.push(body.text);
    await Promise.resolve(); active--;
    return success();
  });
  const plan = planScannerTranslation([block('word '.repeat(500)), block('ⲁ', 'block-2')], 'sahidic');
  const results = [];
  await queue.run(plan, { approved: true, onBlock: result => results.push(result) });
  assert.equal(requests.join(''), plan.blocks.map(b => b.text.trim()).join(''));
  assert.equal(requests.length, 4);
  assert.ok(starts.slice(1).every((time, i) => time - starts[i] >= 2500));
  assert.equal(results.at(-1).complete, true);
  assert.equal(results.at(-1).id, 'block-2');
});
test('completed blocks and chunks survive failure; resume sends only missing parts', async () => {
  let calls = 0;
  const { queue } = harness(() => ++calls === 3 ? Response.json({ error: 'Service unavailable' }, { status: 503 }) : success(`draft ${calls}`));
  const plan = planScannerTranslation([block('short'), block('word '.repeat(500), 'block-2')], 'bohairic');
  const updates = [];
  await assert.rejects(queue.run(plan, { approved: true, onBlock: r => updates.push(r) }), /unavailable/);
  assert.ok(updates.some(r => r.id === 'block-1' && r.complete));
  assert.ok(updates.some(r => r.id === 'block-2' && !r.complete && r.completedParts === 1));
  await queue.run(plan, { approved: true, onBlock: r => updates.push(r) });
  assert.equal(calls, 5, 'three successes plus the failed request and remaining retry only');
  assert.equal(updates.at(-1).complete, true);
  assert.match(updates.at(-1).translation, /draft 2/);
});
test('429 stops without retry; a new approved run respects Retry-After and retained results', async () => {
  let calls = 0;
  const { queue, starts, waits } = harness(() => ++calls === 2
    ? new Response('{}', { status: 429, headers: { 'Retry-After': '90' } }) : success());
  const plan = planScannerTranslation([block('one'), block('two', 'block-2')], 'bohairic');
  await assert.rejects(queue.run(plan, { approved: true }), /90 seconds/);
  assert.equal(calls, 2);
  queue.clear(); // Photo reset cannot bypass the server cooldown.
  await queue.run(plan, { approved: true });
  assert.ok(waits.includes(90000));
  assert.ok(starts[2] - starts[1] >= 90000);
});
test('Retry-After accepts HTTP dates and conservatively handles malformed/zero values', () => {
  const now = Date.parse('2026-10-17T10:00:00Z');
  assert.equal(scannerRetryDelay('Sat, 17 Oct 2026 10:02:00 GMT', now), 120000);
  for (const value of [null, '', 'garbage', '0', '-2']) assert.equal(scannerRetryDelay(value, now), 60000);
});
test('stop during pacing sends no next request and a fresh approval can resume', async () => {
  const controller = new AbortController();
  let calls = 0;
  const queue = createScannerTranslator({ request: async () => { calls++; return success(); },
    wait: async () => { controller.abort(); }, now: () => 0 });
  const plan = planScannerTranslation([block('one'), block('two', 'block-2')], 'bohairic');
  await assert.rejects(queue.run(plan, { approved: true, signal: controller.signal }), /stopped/);
  assert.equal(calls, 1);
});
test('stop ignores an in-flight late response and does not accept it into the cache', async () => {
  const controller = new AbortController();
  let resolve;
  let calls = 0;
  const queue = createScannerTranslator({ request: () => { calls++; return new Promise(done => { resolve = done; }); }, now: () => 0, wait: async () => {} });
  const plan = planScannerTranslation([block('one')], 'bohairic');
  const result = queue.run(plan, { approved: true, signal: controller.signal, onBlock: () => assert.fail('late result') });
  controller.abort(); resolve(success('late'));
  await assert.rejects(result, /stopped/);
  const resumed = queue.run(plan, { approved: true });
  await Promise.resolve(); resolve(success('new'));
  await resumed;
  assert.equal(calls, 2);
});
test('changed text/dialect never reuses an obsolete result', async () => {
  let calls = 0;
  const { queue } = harness(() => { calls++; return success(); });
  for (const [text, dialect] of [['one', 'bohairic'], ['two', 'bohairic'], ['two', 'sahidic']]) {
    await queue.run(planScannerTranslation([block(text)], dialect), { approved: true });
  }
  assert.equal(calls, 3);
});
test('waiting is cancellable and cannot start when already stopped', async () => {
  const controller = new AbortController();
  const pending = waitForScanner(10000, controller.signal);
  controller.abort(); await assert.rejects(pending, /stopped/);
  assert.throws(() => waitForScanner(1, controller.signal), /stopped/);
});
test('offline corpus loading works without AbortSignal.timeout and aborts on timeout', async () => {
  const original = AbortSignal.timeout;
  AbortSignal.timeout = undefined;
  try {
    const data = await loadReference({ fetchImpl: async (url, options) => {
      assert.equal(url, '/reference-translation/bohairic.json');
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json({ version: 1, rows: [] });
    } });
    assert.equal(data.version, 1);
    await assert.rejects(loadReference({ timeoutMs: 5, fetchImpl: async (_url, { signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    }) }), /aborted/);
  } finally { AbortSignal.timeout = original; }
});
test('app source has no remaining local-inference entry point', async () => {
  for (const file of ['app/translator/scanner/page.tsx', 'app/translator/page.tsx', 'lib/translationService.ts']) {
    assert.doesNotMatch(await readFile(file, 'utf8'), /translateLocally|hasLocalTranslator|localTranslation\/client|localTranslation\/worker/);
  }
});
