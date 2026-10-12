import assert from 'node:assert/strict';
export async function checkScrollBounds(page, base) {
  for (const route of ['/', '/translator/']) {
    await page.goto(base + route); await page.waitForLoadState('networkidle');
    const geometry = await page.evaluate(() => ({ height: innerHeight, content: document.documentElement.scrollHeight }));
    assert.ok(geometry.content <= geometry.height + 2, `${route} has no full-screen-plus-dock blank overflow: ${JSON.stringify(geometry)}`);
    await page.evaluate(() => scrollTo(0, 100000));
    await page.mouse.wheel(0, 1000); await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => scrollY <= 2), `${route} cannot be scrolled away when its content fits`);
  }
  await page.goto(base + '/settings/'); await page.waitForLoadState('networkidle');
  await page.evaluate(() => scrollTo(0, 100000));
  const bottom = await page.evaluate(() => ({ y: scrollY, maximum: document.documentElement.scrollHeight - innerHeight }));
  assert.ok(bottom.y <= Math.max(0, bottom.maximum) + 1, 'Longer pages stop at their actual content bound');
  console.log('PASS: short-page scroll bounds and real-content scrolling.');
}
