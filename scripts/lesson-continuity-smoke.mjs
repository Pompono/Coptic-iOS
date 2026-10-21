import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startLesson, finishTransfer } from './learning-smoke.mjs';

const browser = await chromium.launch({headless:true, channel:process.platform === 'win32' ? 'msedge' : undefined});
try {
 const page = await browser.newPage({viewport:{width:390,height:844}});
 await page.goto((process.env.COPTIC_TEST_BASE ?? 'http://127.0.0.1:3000') + '/settings/learning/');
 await page.getByRole('combobox',{name:'Appearance',exact:true}).selectOption('dark');
 await page.goto((process.env.COPTIC_TEST_BASE ?? 'http://127.0.0.1:3000') + '/learn/section-1-unit-01-pair-letters-and-sounds/play/lesson-1-a-o-d/');
 await startLesson(page);
 const answers = ['ⲁ','a','a','dha','dha','ⲇⲁ','o','o','ⲟ','dho','ⲇⲟ','dhad','dho','ⲇⲁⲇ','dhod','dhod','ⲇⲟⲇ','dhad','dha'];
 let previous = 0;
 for(const answer of answers) {
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  await page.locator('.lesson-option-button').getByText(answer,{exact:true}).click();
  await page.getByRole('button',{name:'Check',exact:true}).click();
  const progress = Number(await page.getByRole('progressbar',{name:'Lesson progress'}).getAttribute('aria-valuenow'));
  assert.ok(progress >= previous && progress < 100, 'Progress includes final practice');
  previous = progress;
  await page.getByRole('button',{name:'Continue',exact:true}).click();
 }
 await page.getByLabel('Your answer',{exact:true}).waitFor();
 const bar = page.getByRole('progressbar',{name:'Lesson progress'});
 assert.equal(Number(await bar.getAttribute('aria-valuenow')),previous,'Final practice continues at the same position');
 assert.equal(await bar.locator('div').evaluate(el=>getComputedStyle(el).transitionDuration),'0.22s');
 assert.equal(await page.getByText('Put it together',{exact:true}).count(),0);
 await page.screenshot({path:path.join(tmpdir(),'coptic-lesson-continuity.png')});
 await finishTransfer(page,'a-o-d-letters-and-sounds');
 assert.doesNotMatch(await page.locator('main').innerText(),/Secure means|Difficult items will return/);
 console.log('PASS: continuous animated lesson progress, integrated final practice, clean summary.');
} finally { await browser.close(); }
