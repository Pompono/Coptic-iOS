import { startLesson } from './learning-smoke.mjs';
import assert from 'node:assert/strict';
export async function checkRecordingFailure(browser, base) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.__syntheticSpeechCount = 0;
    speechSynthesis.speak = () => { window.__syntheticSpeechCount++; };
  });
  const page = await context.newPage();
  const pattern = '**/audio/learn/shared/a.wav';
  try {
    await page.route(pattern, route => route.abort());
    await page.goto(base + '/learn/section-1-unit-01-pair-letters-and-sounds/play/lesson-1-a-o-d/');
    await page.waitForLoadState('networkidle');
    await startLesson(page);
    await page.locator('.lesson-audio-card').first().click();
    await page.getByRole('alert').filter({ hasText: 'The recording could not play.' }).waitFor();
    assert.equal(await page.evaluate(() => window.__syntheticSpeechCount), 0, 'Recording failure never silently reads the letters using a synthetic voice');
    await page.unroute(pattern);
    await page.locator('.lesson-audio-card').first().click();
    await page.locator('.audio-error-notice').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => window.__syntheticSpeechCount), 0);
    console.log('PASS: failed recording shows a visible error without synthetic speech, and successful retry clears it.');
  } finally { await context.close(); }
}
