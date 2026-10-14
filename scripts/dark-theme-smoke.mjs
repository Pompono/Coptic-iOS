import { startLesson } from './learning-smoke.mjs';
import assert from 'node:assert/strict';
import { finishTransfer } from './learning-smoke.mjs';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = ts.transpileModule(await readFile('lib/lesson.ts', 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { lessons } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function contrast(foreground, background) {
  const luminance = rgb => {
    const parts = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => x / 255);
    return parts.map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
async function colors(locator) {
  return locator.evaluate(node => {
    const style = getComputedStyle(node);
    return { text: style.color, background: style.backgroundColor, gradient: style.backgroundImage };
  });
}
export async function checkDarkTheme(page, base) {
  await page.goto(base + '/settings/'); await page.waitForLoadState('networkidle');
  await page.getByRole('combobox', { name: 'App theme', exact: true }).selectOption('dark');
  for (const route of ['/', '/learn/', '/dictionary/', '/translator/', '/read/', '/vocabulary/', '/settings/', '/translator/scanner/']) {
    await page.goto(base + route); await page.waitForLoadState('networkidle');
    const body = await colors(page.locator('body'));
    assert.equal(body.background, 'rgb(8, 12, 16)', `${route}: app background stays dark`);
    assert.ok(contrast(body.text, body.background) >= 4.5, `${route}: readable page text`);
    if (route === '/learn/') {
      const main = await colors(page.locator('main'));
      assert.equal(main.background, body.background, 'Learning pathway uses the dark page palette');
    }
  }
  const exerciseSets = ['a-o-d-letters-and-sounds', 'section-1-unit-2-group-1-lesson-1', 'section-1-unit-2-group-1-lesson-2'];
  for (const set of exerciseSets) {
    const lesson = lessons.find(lesson => lesson.progressionGroups?.some(group => group.lessons.some(step => step.exerciseSet === set)));
    const step = lesson.progressionGroups.flatMap(group => group.lessons).find(step => step.exerciseSet === set);
    await page.goto(`${base}/learn/${lesson.id}/play/${step.id}/`); await page.waitForLoadState('networkidle');
    await startLesson(page);
    await page.getByRole('button', { name: 'Check', exact: true }).waitFor();
    const main = await colors(page.locator('main'));
    assert.ok(main.gradient.includes('rgb(8, 12, 16)'), `${set}: lesson background is dark`);
    assert.ok(contrast(main.text, 'rgb(8, 12, 16)') >= 4.5);
    const disabled = await colors(page.getByRole('button', { name: 'Check', exact: true }));
    assert.ok(contrast(disabled.text, disabled.background) >= 4.5, 'Disabled action remains legible');
    if (set === exerciseSets[0]) {
      const card = await colors(page.locator('.lesson-audio-card').first());
      const cardBackground = card.gradient.match(/rgb\([^)]*\)/)[0];
      assert.ok(contrast(card.text, cardBackground) >= 4.5, 'Prompt card contrast');
      const wrong = page.getByRole('button', { name: 'ⲟ', exact: true });
      await wrong.click();
      const selected = await colors(wrong);
      assert.ok(contrast(selected.text, selected.background) >= 4.5, 'Selected answer contrast');
      await page.getByRole('button', { name: 'Check', exact: true }).click();
      const wrongFeedback = await colors(wrong);
      assert.ok(contrast(wrongFeedback.text, wrongFeedback.background) >= 4.5, 'Wrong answer contrast');
      const correctFeedback = await colors(page.getByRole('button', { name: 'ⲁ', exact: true }));
      assert.ok(contrast(correctFeedback.text, correctFeedback.background) >= 4.5, 'Correct answer contrast');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.waitForTimeout(300);
      const remaining = ['a', 'a', 'dha', 'dha', 'ⲇⲁ', 'o', 'o', 'ⲟ', 'dho', 'ⲇⲟ', 'dhad', 'dho', 'ⲇⲁⲇ', 'dhod', 'dhod', 'ⲇⲟⲇ', 'dhad', 'dha', 'ⲁ'];
      for (const [index, answer] of remaining.entries()) {
        await page.getByRole('button', { name: 'Check', exact: true }).waitFor();
        await page.getByRole('button', { name: answer, exact: true }).click();
        await page.getByRole('button', { name: 'Check', exact: true }).click();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        if (index < remaining.length - 1) await page.waitForTimeout(300);
      }
      await finishTransfer(page,set);
      const outcome = page.locator('.lesson-outcome-screen');
      await outcome.waitFor();
      assert.equal((await colors(outcome)).background, 'rgb(8, 12, 16)', 'Completion screen stays dark');
    }
  }
  await page.goto(base + '/settings/'); await page.waitForLoadState('networkidle');
  await page.getByRole('combobox', { name: 'App theme', exact: true }).selectOption('light');
  await page.goto(base + '/learn/'); await page.waitForLoadState('networkidle');
  const light = await colors(page.locator('main'));
  assert.equal(light.background, 'rgb(248, 247, 243)', 'Switching back restores the warm-white palette');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload(); await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('.unit-banner').first().evaluate(node => getComputedStyle(node).opacity), '1', 'Reduced motion keeps pathway headings visible');
  assert.equal(await page.locator('.course-row').first().evaluate(node => getComputedStyle(node).opacity), '1', 'Reduced motion keeps lesson nodes visible');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  console.log('PASS: dark-mode continuity across app pages and all three lesson renderers, readable answer states, and restoration of light mode.');
}
