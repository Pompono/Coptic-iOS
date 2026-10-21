import assert from 'node:assert/strict';

// This is deliberately independent of optional model installation. All online
// calls are mocked; published lookup uses the real bundled offline corpus.
export async function checkHostedTranslation(page, context) {
  const endpoint = 'https://coptlingo.com/api/translate';
  const calls = [];
  let status = 200;
  let delayed = false;
  await context.route('https://coptlingo.com/api/translate**', async route => {
    calls.push({ url: route.request().url(), body: route.request().postDataJSON() });
    if (delayed) await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ status, json: status === 200
      ? { translation: route.request().url().endsWith('en-coptic') ? 'ⲟⲩϫⲁⲓ' : 'Hosted AI mock', dialect: 'bohairic', confidence: 0.9 }
      : { error: 'internal diagnostic must stay hidden' } });
  });
  try {
    await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
    const coptic = page.getByRole('textbox', { name: 'Coptic text', exact: true });
    const submit = page.getByRole('button', { name: 'Translate', exact: true });
    const ai = page.getByRole('button', { name: 'Experimental AI · online', exact: true });
    await coptic.fill('ⲛⲑⲟ ⲧⲉ ϯϩⲣⲏⲣⲓ: ⲛ̀ⲧⲉ ⲡⲓⲥⲑⲟⲓⲛⲟⲩϥⲓ: ⲑⲏⲉⲧⲁⲥⲫⲓⲣⲓ ⲉ̀ⲃⲟⲗ: ϧⲉⲛ ⲑⲛⲟⲩⲛⲓ ⲛ̀ⲓⲉⲥⲥⲉ.');
    await submit.click();
    await page.getByText('You are the flower, of incense, that has blossomed, from the root of Jesse.', { exact: true }).waitFor();
    assert.equal(calls.length, 0, 'Published matching works offline without a model or API');
    await ai.click();
    assert.equal(await page.getByText('You are the flower, of incense, that has blossomed, from the root of Jesse.', { exact: true }).count(), 0);
    await submit.click();
    await page.getByRole('alert').filter({ hasText: 'AI translation needs an internet connection' }).waitFor();
    assert.equal(calls.length, 0, 'AI never falls back to published text offline');
    await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }));
    await submit.click();
    await page.getByText('Hosted AI mock', { exact: true }).waitFor();
    assert.equal(calls[0].url, endpoint);
    assert.equal(calls[0].body.includeConfidence, true);
    assert.equal(calls[0].body.dialect, 'bohairic');
    assert.equal('method' in calls[0].body, false);
    await page.getByText('Unverified AI draft', { exact: true }).waitFor();
    await coptic.fill('ⲁ'.repeat(1201));
    await submit.click();
    await page.getByRole('alert').filter({ hasText: '1,200' }).waitFor();
    assert.equal(calls.length, 1);
    await coptic.fill('ⲁ'.repeat(1200));
    await submit.click();
    await page.getByText('Hosted AI mock', { exact: true }).waitFor();
    assert.equal(calls.length, 2);
    await page.getByRole('button', { name: 'Switch translation direction', exact: true }).click();
    await page.getByRole('textbox', { name: 'English text', exact: true }).fill('Hello');
    await submit.click();
    await page.getByText('ⲟⲩϫⲁⲓ', { exact: true }).waitFor();
    assert.equal(calls.at(-1).url, `${endpoint}/en-coptic`);
    status = 429;
    await submit.click();
    await page.getByRole('alert').filter({ hasText: 'wait a minute' }).waitFor();
    status = 503;
    await submit.click();
    await page.getByRole('alert').filter({ hasText: 'unavailable' }).waitFor();
    status = 200;
    delayed = true;
    await submit.click();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Dictionary', exact: true }).click();
    await page.getByRole('heading', { name: 'Dictionary', exact: true }).waitFor();
    console.log('PASS: offline published lookup, explicit hosted AI in both directions, limits, 429/503 errors, and navigation during a request.');
  } finally {
    await context.unroute('https://coptlingo.com/api/translate**');
  }
}
