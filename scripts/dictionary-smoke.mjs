import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { indexSearchEntry, crossReferences } from '../lib/dictionary/search.mjs';

export async function checkDictionary(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  try {
    await page.goto(base + '/dictionary/');
    await page.getByText(/shown.*total/).waitFor();
    const query = page.getByRole('textbox', { name: 'Dictionary search' });
    const cards = page.locator('a[href^="/dictionary/entry/"]');
    await page.getByLabel('Search in', { exact: true }).selectOption('transliteration');
    await query.fill('agapi');
    await page.getByText('Transliteration · approximate spelling', { exact: false }).first().waitFor();
    await page.locator('a[href^="/dictionary/entry/"]').filter({ hasText: 'ⲁⲅⲁⲡⲏ' }).first().waitFor();
    await page.getByLabel('Search in', { exact: true }).selectOption('english');
    await query.fill('god love');
    await page.getByText('Definition · whole words', { exact: false }).first().waitFor();
    assert.ok(await cards.count() > 0);
    await query.fill('lvoe');
    await page.getByRole('button', { name: 'love', exact: true }).waitFor();
    assert.equal(await query.inputValue(), 'lvoe', 'Suggestions do not silently rewrite input');
    await page.getByRole('button', { name: 'love', exact: true }).click();
    await page.getByText('English meaning · exact', { exact: true }).first().waitFor();
    await page.getByLabel('Search in', { exact: true }).selectOption('coptic');
    await query.fill('ⲁ');
    await page.getByLabel('Search without combining marks').uncheck();
    await page.waitForTimeout(250);
    assert.ok(!(await cards.allTextContents()).includes('ⲁ̄'));
    assert.equal(await page.locator('a[href^="crum:"]').count(), 0);
    await page.getByRole('link', { name: 'ⲁ', exact: true }).first().click();
    await page.getByRole('heading', { name: 'ⲁ', exact: true }).waitFor();
    await page.getByText('First letter of the alphabet', { exact: true }).waitFor();
    await page.getByText('Crum 1a', { exact: true }).first().waitFor();
    assert.ok(await page.getByRole('button', { name: 'Bohairic-only', exact: true }).isDisabled());
    await page.getByRole('link', { name: '← Back', exact: true }).click();
    await query.waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Dictionary search"]').value === 'ⲁ');
    assert.equal(await page.getByLabel('Search in', { exact: true }).inputValue(), 'coptic');
    assert.ok(!(await page.getByLabel('Search without combining marks').isChecked()));
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await query.fill('zzzz_no_such_word_zzzz');
    await page.getByRole('status').filter({ hasText: 'No matching entries' }).waitFor();
    assert.equal(await cards.count(), 0);
    const raw = JSON.parse(await readFile('public/bohairic_dictionary.json', 'utf8'));
    const index = raw.map(r => indexSearchEntry({ lemma: r.word, forms: r.bohairic_variants, gloss: r.senses }));
    const reference = index.find(item => crossReferences(item.entry, index).some(target => target !== item.entry.lemma));
    const target = crossReferences(reference.entry, index).find(target => target !== reference.entry.lemma);
    await page.goto(base + '/dictionary/entry/?lemma=' + encodeURIComponent(reference.entry.lemma));
    await page.getByRole('link', { name: 'See ' + target, exact: true }).first().click();
    await page.getByRole('heading', { name: target, exact: true }).waitFor();
    // Missing dictionary resources surface a themed error and can be retried.
    const fail = route => route.fulfill({ status: 404, body: 'Missing' });
    await page.route('**/bohairic_dictionary.json', fail);
    await page.goto(base + '/dictionary/');
    await page.getByRole('alert').filter({ hasText: 'Failed to load dictionary files' }).waitFor();
    await page.unroute('**/bohairic_dictionary.json', fail);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByText(/shown.*total/).waitFor();
    await page.getByRole('alert').filter({ hasText: 'Failed to load dictionary files' }).waitFor({ state: 'hidden' });
    await page.waitForLoadState('networkidle');
    assert.deepEqual(errors, []);
    console.log('PASS: dictionary transliteration, ranked multiword meanings, manual suggestions, strict marks, entry links, preferences and empty results work offline.');
  } catch (error) { console.error("Dictionary failure:", (await page.locator("body").innerText()).slice(0, 2400)); throw error; } finally { await context.close(); }
}
