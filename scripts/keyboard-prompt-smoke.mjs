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
    assert.equal(await page.getByText('On-screen Coptic Keyboard', {exact:true}).count(), 0);
    // Use the last visible Settings category to check that the dock does not cover it.
    const lastCategory = page.getByRole('link', { name: /Keyboard/u });
    await lastCategory.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const category = await lastCategory.boundingBox();
    const dock = await page.getByRole('navigation', {name:'Mobile navigation'}).boundingBox();
    assert.ok(category.y + category.height < dock.y, 'Settings categories remain visible above the dock');
    await page.evaluate(() => {localStorage.setItem('coptic-keyboard-enabled','true');sessionStorage.setItem('coptic-keyboard-visible-session','true');});
    for (const width of [390,1024]) {
      await page.setViewportSize({width,height:844});
      for (const route of ['/dictionary/','/translator/']) {
        await page.goto(base + route); await page.waitForLoadState('networkidle');
        assert.equal(await page.getByRole('button', {name:/Show Coptic keyboard|Hide Coptic keyboard/i}).count(),0);
        assert.equal(await page.locator('.coptic-keyboard').count(),0);
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(base + '/settings/'); await page.waitForLoadState('networkidle');
    const tabs = page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link');
    assert.equal(await tabs.nth(2).getAttribute('aria-label'), 'Home', 'Home is the middle tab');
    await page.evaluate(() => localStorage.removeItem('coptic-ios-keyboard-prompt-dismissed'));
    await page.reload(); await prompt.waitFor();
    await prompt.getByRole('button', { name: 'Already installed' }).click();
    await page.reload(); await page.waitForLoadState('networkidle');
    assert.equal(await prompt.count(), 0);
    console.log('PASS: iOS keyboard prompt repeats after temporary dismissal, saves permanent dismissal, and keeps the built-in keyboard disabled even with legacy enabled preferences.');
  } finally { await context.close(); }
}
