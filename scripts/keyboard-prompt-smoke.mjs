import assert from 'node:assert/strict';

export async function checkKeyboardPrompt(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
  const page = await context.newPage();
  try {
    await page.goto(base + '/');
    const prompt = page.getByRole('dialog', { name: 'Type Coptic on your iPhone' });
    await prompt.waitFor();
    assert.match(await prompt.getByRole('link').getAttribute('href'), /apps\.apple\.com\/us\/app\/coptic-keyboard\/id1510907422/);
    await prompt.getByRole('button', { name: 'Close keyboard prompt' }).click();
    await page.reload();
    await prompt.waitFor();
    await prompt.getByRole('checkbox', { name: 'Don’t show again' }).click();
    await page.reload(); await page.waitForLoadState('networkidle');
    assert.equal(await prompt.count(), 0, 'Permanent dismissal survives relaunch');
    await page.goto(base + '/settings/'); await page.waitForLoadState('networkidle');
    assert.equal(await page.getByRole('button', { name: 'Disabled', exact: true }).getAttribute('aria-pressed'), 'true', 'Mobile keyboard defaults disabled');
    await page.getByRole('button', { name: 'Enabled', exact: true }).click();
    await page.reload(); await page.waitForLoadState('networkidle');
    assert.equal(await page.getByRole('button', { name: 'Enabled', exact: true }).getAttribute('aria-pressed'), 'true', 'An explicit keyboard preference remains saved');
    const tabs = page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link');
    assert.equal(await tabs.nth(2).getAttribute('aria-label'), 'Home', 'Home is the middle tab');
    await page.evaluate(() => localStorage.removeItem('coptic-ios-keyboard-prompt-dismissed'));
    await page.reload(); await prompt.waitFor();
    await prompt.getByRole('button', { name: 'Already installed' }).click();
    await page.reload(); await page.waitForLoadState('networkidle');
    assert.equal(await prompt.count(), 0);
    console.log('PASS: iOS keyboard prompt repeats after temporary dismissal, saves permanent dismissal, and respects mobile defaults and opt-in.');
  } finally { await context.close(); }
}
