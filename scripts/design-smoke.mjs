import assert from 'node:assert/strict';
import {loadTsModule} from '../tests/tsModule.mjs';
const {lessons}=await loadTsModule('lib/lesson.ts');
export async function checkDesign(browser,base){
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base+'/');await page.waitForLoadState('networkidle');
  const first=lessons[0],group=first.progressionGroups[0];
  assert.match(await page.getByRole('link',{name:'Start learning',exact:true}).getAttribute('href'),/lesson-1-a-o-d/);
  const tabs=page.getByRole('navigation',{name:'Mobile navigation'});
  assert.equal(await tabs.getByRole('link',{name:'Home',exact:true}).getAttribute('aria-current'),'page');
  assert.equal(await tabs.getByText('Dictionary',{exact:true}).count(),1,'Tabs have visible labels');
  await page.evaluate(({id,steps})=>localStorage.setItem('coptic-unit-progress:'+id,JSON.stringify(steps)),{id:first.id,steps:group.lessons.map(s=>s.id)});
  await page.reload();await page.waitForLoadState('networkidle');
  assert.match(await page.getByRole('link',{name:'Continue learning',exact:true}).getAttribute('href'),/lesson-6-a-ou-da/,'Home resumes the unlocked lesson');
  await page.goto(base+'/learn/');await page.waitForLoadState('networkidle');
  const unit=page.locator('.course-unit-block').first();
  assert.match(await unit.getByRole('link',{name:'Review',exact:true}).getAttribute('href'),/group-1-review/,'Completed groups keep their review lesson');
  assert.match(await unit.getByRole('link',{name:'Start',exact:true}).getAttribute('href'),/lesson-6-a-ou-da/);
  assert.ok(await unit.getByText('Complete earlier lessons to unlock',{exact:true}).count()>0);
  await page.goto(base+'/read/');await page.waitForLoadState('networkidle');
  assert.ok(await page.getByRole('button',{name:/Look up/}).first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=30,'Passage buttons retain their Coptic type size');
  for(const theme of ['light','dark']){
   for(const route of ['/','/dictionary/','/translator/','/settings/','/read/','/vocabulary/','/translator/scanner/']){
    await page.goto(base+route);await page.waitForLoadState('networkidle');
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize='24px';},theme);
    await page.setViewportSize({width:360,height:640});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+route+' fits a small phone at larger type');
   }
   await page.goto(base+'/learn/'+first.id+'/play/lesson-1-a-o-d/');await page.waitForLoadState('networkidle');
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize='24px';},theme);
   const ready=await page.getByRole('button',{name:'I’m ready',exact:true}).boundingBox();
   assert.ok(ready.y+ready.height<=640,'Guide action remains visible at larger type');
  }
  await page.waitForLoadState('networkidle');assert.deepEqual(errors,[]);
  console.log('PASS: real home continuation, course lock/review links, labelled tabs, Coptic reading size, and small-phone light/dark layouts at larger text sizes.');
 }finally{await context.close();}
}
