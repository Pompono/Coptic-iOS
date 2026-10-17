import assert from 'node:assert/strict';

// Run after real OCR/correction checks, against the actual scanner screen. Never
// call production: intercepted requests must contain the approved text only.
export async function checkScannerHosted(page) {
  const context = page.context();
  const calls = [];
  let failAt = 0;
  let status = 503;
  let slow = false;
  await context.route('https://coptlingo.com/api/translate', async route => {
    const body = route.request().postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), ['dialect', 'includeConfidence', 'text']);
    assert.ok(Array.from(body.text).length <= 1200);
    assert.ok(!JSON.stringify(body).includes('data:image'));
    calls.push(body);
    if (slow) await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: calls.length === failAt ? status : 200,
      headers: { 'Retry-After': '60' }, json: calls.length === failAt ? { error: 'private upstream diagnostics' }
        : { translation: body.text === 'ⲡⲉⲛⲛⲟⲩϯ' ? 'our God' : `Hosted draft ${calls.length}`, dialect: body.dialect } });
  });
  const input = page.getByLabel('Recognised Coptic text', { exact: true });
  const translate = page.getByRole('button', { name: 'Translate block', exact: true });
  const review = page.getByRole('dialog', { name: 'Review text before sending' });
  const approve = async () => {
    await review.getByRole('checkbox').check();
    await review.getByRole('button', { name: 'Send approved text', exact: true }).click();
  };
  const idle = () => page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Translate block' && !b.disabled));
  try {
    await page.getByLabel('Translation method', { exact: true }).selectOption('experimental');
    assert.equal(calls.length, 0, 'Selecting AI or correcting text never transmits');
    await translate.click();
    await review.waitFor();
    assert.equal(await review.getByRole('button', { name: 'Send approved text', exact: true }).isDisabled(), true);
    assert.match(await review.innerText(), /Photographs, image crops, and OCR metadata stay on this device/);
    assert.equal(calls.length, 0);
    await review.getByRole('button', { name: 'Cancel sending', exact: true }).click();
    assert.equal(calls.length, 0);
    await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }));
    await translate.click(); await approve(); await idle();
    assert.deepEqual(calls[0], { text: 'ⲡⲉⲛⲛⲟⲩϯ', dialect: 'bohairic', includeConfidence: false });
    assert.match(await page.getByRole('button', { name: 'Review text block 1', exact: true }).innerText(), /our God/);

    await input.fill('word '.repeat(500)); // Three chunks, no editor truncation.
    assert.equal((await input.inputValue()).length, 2500);
    failAt = calls.length + 2;
    await translate.click(); await approve(); await idle();
    await page.getByRole('heading', { name: 'Partial AI draft · 1 of 3 parts', exact: true }).waitFor();
    assert.match(await page.getByRole('alert').filter({ hasText: 'Translation service' }).innerText(), /unavailable/);
    const previous = calls.length;
    failAt = 0;
    await page.getByRole('button', { name: 'Translate remaining blocks', exact: true }).click();
    await approve(); await idle();
    assert.equal(calls.slice(previous).filter(c => c.text.startsWith('word')).length, 2, 'completed chunk was not resent');
    await page.getByRole('heading', { name: 'Unverified hosted AI draft', exact: true }).waitFor();

    await input.fill('stop this request'); slow = true;
    const count = calls.length;
    await translate.click(); await approve();
    // Wait for the mock to receive this request, so Stop exercises in-flight
    // cancellation rather than only the queue's pacing delay.
    for (let i = 0; calls.length === count && i < 40; i++) await page.waitForTimeout(100);
    assert.equal(calls.length, count + 1);
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.waitForTimeout(600);
    assert.doesNotMatch(await page.getByRole('button', { name: 'Review text block 1', exact: true }).innerText(), /Hosted draft/);
    slow = false;

    await input.fill('rate limited text'); failAt = calls.length + 1; status = 429;
    await translate.click(); await approve(); await idle();
    await page.getByRole('alert').filter({ hasText: 'no automatic retry' }).waitFor();
    const limitedCount = calls.length;
    await page.waitForTimeout(200);
    assert.equal(calls.length, limitedCount);
    console.log('PASS: scanner approval/cancel, text-only requests, lossless long blocks, paced chunks, partial-result resume, late-response rejection, and 429 stop.');
  } finally { await context.unroute('https://coptlingo.com/api/translate'); }
}
