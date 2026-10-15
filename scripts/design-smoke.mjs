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
  await page.goto(base+'/dictionary/settings/');await page.waitForLoadState('networkidle');
  assert.equal(await page.getByText(/Transliteration accepts spellings/).count(),0);
  const lockedSwitch=page.getByRole('switch',{name:'Bohairic-only',exact:true});
  await lockedSwitch.click({force:true});assert.equal(await lockedSwitch.isChecked(),true,'A locked switch stays on');
  await page.getByRole('status').filter({hasText:'This is locked by Settings.'}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('.settings-lock-notice').classList.contains('is-visible'));
  await lockedSwitch.focus();await page.keyboard.press('Space');
  await page.getByRole('status').filter({hasText:'This is locked by Settings.'}).waitFor();
  assert.equal(await lockedSwitch.isChecked(),true,'Keyboard activation also respects the settings lock');
  // Catch the inconsistent hierarchy and missing heritage artwork from the last revision.
  const headings=[];
  for(const route of ['/','/learn/','/dictionary/','/translator/','/settings/','/read/','/vocabulary/','/translator/scanner/']){
   await page.goto(base+route);await page.waitForLoadState('networkidle');
   const header=page.locator('.page-header');
   assert.equal(await header.count(),1,route+' has one shared page header');
   const layout=await header.evaluate(el=>{
    const title=el.querySelector('h1'),subtitle=el.querySelector(':scope > p'),style=getComputedStyle(title);
    return {subtitleFont:getComputedStyle(subtitle).fontSize,subtitleLine:getComputedStyle(subtitle).lineHeight,subtitleMargin:getComputedStyle(subtitle).marginBottom,font:style.fontSize,weight:style.fontWeight,line:style.lineHeight,subtitleBelow:subtitle.getBoundingClientRect().top>=title.getBoundingClientRect().bottom};
   });
   assert.ok(layout.subtitleBelow,route+' puts supporting text after the title');
   headings.push({font:layout.font,weight:layout.weight,line:layout.line,subtitleFont:layout.subtitleFont,subtitleLine:layout.subtitleLine,subtitleMargin:layout.subtitleMargin});
   const art=page.locator('.mobile-chin-dock__item[aria-label="Translator"] .heritage-icon__art');
   assert.match(await art.evaluate(el=>getComputedStyle(el).maskImage),/translate-tab-icon.svg/,'Coptic-letter translator artwork remains in the tab bar');
  }
  assert.ok(headings.every(style=>JSON.stringify(style)===JSON.stringify(headings[0])),'All main pages share title typography');
  for(const [route,selector,min] of [
   ['/translator/','button[type=submit]',50],['/translator/','select[aria-label="Translation method"]',44],
   ['/settings/','select',44],['/dictionary/','.dictionary-pagination button',44],
   ['/read/','[role=group][aria-label="Reading passage"] button',44],['/translator/scanner/','button',44]
  ]){
   await page.goto(base+route);await page.waitForLoadState('networkidle');
   const heights=await page.locator(selector).evaluateAll(els=>els.filter(el=>el.getBoundingClientRect().height>0).map(el=>el.getBoundingClientRect().height));
   assert.ok(heights.length>0&&heights.every(height=>height>=min),route+' controls have consistent touch targets');
  }
  await page.goto(base+'/dictionary/');await page.waitForLoadState('networkidle');
  await page.locator('.dictionary-search-shell').click({position:{x:8,y:8}});
  assert.equal(await page.getByRole('textbox',{name:'Dictionary search'}).evaluate(el=>document.activeElement===el),true,'The whole search field focuses its input');
  await page.goto(base+'/read/');await page.waitForLoadState('networkidle');
  assert.ok(await page.getByRole('button',{name:/Look up/}).first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=30,'Passage buttons retain their Coptic type size');
  for(const theme of ['light','dark']){
   for(const route of ['/','/dictionary/','/dictionary/settings/','/dictionary/entry/?lemma=ⲁ','/translator/','/settings/','/read/','/vocabulary/','/translator/scanner/','/learn/']){
    await page.goto(base+route);await page.waitForLoadState('networkidle');
    await page.setViewportSize({width:360,height:640});
    for(const size of [24,40]){
     await page.evaluate(({theme,size})=>{document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize=size+'px';document.documentElement.dataset.largeText=size>24?'true':'false';},{theme,size});
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+route+' fits a small phone at '+size+'px type');
    }
   }
   await page.goto(base+'/learn/'+first.id+'/play/lesson-1-a-o-d/');await page.waitForLoadState('networkidle');
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.style.fontSize='24px';},theme);
   const ready=await page.getByRole('button',{name:'I’m ready',exact:true}).boundingBox();
   assert.ok(ready.y+ready.height<=640,'Guide action remains visible at larger type');
   await page.evaluate(()=>{const shell=document.querySelector('.mobile-chin-page-shell');shell.style.paddingTop='59px';shell.style.paddingBottom='34px';shell.style.setProperty('--page-content-height','calc(100svh - 93px)');});
   const insetReady=await page.getByRole('button',{name:'I’m ready',exact:true}).boundingBox();
   assert.ok(insetReady.y+insetReady.height<=606&&insetReady.y+insetReady.height>=582,'The bottom safe area is reserved once, not twice');
  }
  await page.goto(base+'/translator/');await page.waitForLoadState('networkidle');
  await page.getByRole('textbox',{name:'Coptic text',exact:true}).focus();
  await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>400});window.visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>document.querySelector('.mobile-chin-page-shell').dataset.keyboard==='true');
  assert.equal(await page.getByRole('navigation',{name:'Mobile navigation'}).count(),0,'Tabs make room for the system keyboard');
  assert.equal(await page.locator('.mobile-chin-page-shell').evaluate(el=>getComputedStyle(el).paddingBottom),'0px');
  await page.evaluate(()=>{delete window.visualViewport.height;window.visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForLoadState('networkidle');assert.deepEqual(errors,[]);
  console.log('PASS: real home continuation, course lock/review links, labelled tabs, Coptic reading size, and small-phone light/dark layouts at larger text sizes.');
 }finally{await context.close();}
}
