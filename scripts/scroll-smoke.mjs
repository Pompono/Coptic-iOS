import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = ts.transpileModule(await readFile('lib/lesson.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { lessons } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
export async function checkScrollBounds(page, base) {
  for (const route of ['/', '/translator/']) {
    await page.goto(base + route); await page.waitForLoadState('networkidle');
    const geometry = await page.evaluate(() => ({ height: innerHeight, content: document.documentElement.scrollHeight }));
    assert.ok(geometry.content <= geometry.height + 2, `${route} has no full-screen-plus-dock blank overflow: ${JSON.stringify(geometry)}`);
    await page.evaluate(() => scrollTo(0, 100000));
    await page.mouse.wheel(0, 1000); await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => scrollY <= 2), `${route} cannot be scrolled away when its content fits`);
  }
  await page.goto(base + '/learn/'); await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => scrollY), 0, 'General learning pathway opens at the top after progress loads');
  const first = lessons[0];
  const progressKey = 'coptic-unit-progress:' + first.id;
  const previousProgress = await page.evaluate(key => localStorage.getItem(key), progressKey);
  await page.evaluate(({ key, steps }) => localStorage.setItem(key, JSON.stringify(steps)), {
    key: progressKey, steps: first.progressionGroups.flatMap(group => group.lessons.map(step => step.id))
  });
  await page.addInitScript(() => {
    window.__pathScrollFrames = [];
    let count = 0;
    const record = () => { window.__pathScrollFrames.push(scrollY); if (++count < 90) requestAnimationFrame(record); };
    requestAnimationFrame(record);
  });
  await page.goto(base + '/learn/'); await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const positions = await page.evaluate(() => window.__pathScrollFrames);
  const finalY = await page.evaluate(() => scrollY);
  assert.equal(positions[0], 0, 'The pathway paints from the top');
  assert.ok(finalY > 100, 'An off-screen in-progress unit is brought into view');
  assert.ok(positions.some(y => y > 0 && y < finalY - 10), 'The move is animated rather than a jump');
  const banner = await page.locator('.course-unit-block.is-focused .unit-banner').boundingBox();
  assert.ok(banner.y >= 20 && banner.y <= 100, 'The complete unit heading has breathing room above it');
  await page.evaluate(({ key, value }) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value), { key: progressKey, value: previousProgress });
  await page.goto(base + '/settings/'); await page.waitForLoadState('networkidle');
  await page.evaluate(() => scrollTo(0, 100000));
  const bottom = await page.evaluate(() => ({ y: scrollY, maximum: document.documentElement.scrollHeight - innerHeight }));
  assert.ok(bottom.y <= Math.max(0, bottom.maximum) + 1, 'Longer pages stop at their actual content bound');
  await page.goto(base + '/read/'); await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Look up/, exact: false }).first().click();
  await page.evaluate(() => scrollTo(0, 100000));
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Settings', exact: true }).click();
  await page.waitForURL(url => url.pathname.replace(/\/$/, '') === '/settings');
  await page.waitForFunction(() => scrollY === 0);
  assert.ok((await page.getByRole('heading', { name: 'Settings', exact: true }).boundingBox()).y >= 0, 'Forward tab navigation starts at the top');
  console.log('PASS: short-page scroll bounds and real-content scrolling.');
}
