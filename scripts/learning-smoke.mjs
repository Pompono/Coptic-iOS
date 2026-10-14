import assert from 'node:assert/strict';
import { loadTsModule } from '../tests/tsModule.mjs';
const {getCourseItems}=await loadTsModule('lib/learning/content.ts');
const {lessons}=await loadTsModule('lib/lesson.ts');
export async function startLesson(page) {
 const ready=page.getByRole('button',{name:'I’m ready',exact:true});
 await ready.waitFor();
 assert.equal(await page.getByRole('button',{name:'Check',exact:true}).count(),0,'Guide has its own screen');
 const footer=await ready.boundingBox();
 assert.ok(footer.y+footer.height<=await page.evaluate(()=>innerHeight),'Ready button remains visible');
 await ready.click();
}
export async function finishTransfer(page,set,{newLesson=false}={}){
 const items=getCourseItems(set);
 if(!newLesson)await page.getByRole('heading',{name:'Put it together',exact:true}).waitFor();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 const checkpoint=set.includes('checkpoint');
 const count=checkpoint?items.length:newLesson?items.length*3:Math.min(3,items.length);
 for(let index=0;index<count;index++){
  const item=items[index%items.length],kind=checkpoint?index%3:newLesson?Math.floor(index/items.length)%3:2;
  if(kind===0){
   const joined=!item.word.includes(' '),words=joined?item.word.startsWith('ⲡⲓ')?['ⲡⲓ',item.word.slice(2)]:Array.from(item.word):item.word.split(' ');
   for(const word of words)await page.getByRole('group',{name:'Available phrase pieces',exact:true}).getByRole('button',{name:word,exact:true}).all().then(async buttons=>{ for(const button of buttons)if(await button.isEnabled()){await button.click();break;} });
  }else if(kind===1){const chars=Array.from(item.word);await page.getByLabel('Missing letter',{exact:true}).fill(chars[Math.max(0,chars.length-2)]);}
  else await page.getByLabel('Your answer',{exact:true}).fill(item.meaning.replace(/^Sound: /,''));
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Correct.'}).waitFor();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
 }
 await page.getByRole('heading',{name:'Lesson complete',exact:true}).waitFor();
}
export async function checkLearning(browser,base){
 const context=await browser.newContext({viewport:{width:360,height:640}});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 try{
  const unit=lessons.find(l=>l.unitNumber===2&&l.sectionId==='section-1');
  const step=unit.progressionGroups[0].lessons.find(s=>s.exerciseSet==='bohairic-noun-phrases');
  await page.goto(`${base}/learn/${unit.id}/play/${step.id}/`);
  await startLesson(page);
  await page.getByRole('heading',{name:'Articles and nouns',exact:true}).waitFor();
  await page.getByRole('button',{name:'ⲡⲓⲣⲱⲙⲓ',exact:true}).click();
  await page.getByText(/ⲡⲓ- is the masculine singular definite article/).waitFor();
  await finishTransfer(page,step.exerciseSet,{newLesson:true});
  assert.match(await page.locator('main').innerText(),/Building/);
  assert.doesNotMatch(await page.locator('main').innerText(),/3 Secure/);
  const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem('coptic-learning:v1')));
  assert.equal(Object.keys(progress.skills).length,3);
  assert.equal(await page.getByRole('navigation',{name:'Mobile navigation'}).count(),0);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.waitForURL(`${base}/learn/${unit.id}/`);
  await page.waitForLoadState('networkidle');
  // Put a learned item due; the next lesson brings it into the flow directly.
  await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('coptic-learning:v1'));const first=Object.values(data.skills)[0];first.dueAt=0;localStorage.setItem('coptic-learning:v1',JSON.stringify(data));});
  const next=unit.progressionGroups[0].lessons.find(s=>s.exerciseSet==='bohairic-names-and-phrases');
  await page.goto(`${base}/learn/${unit.id}/play/${next.id}/`);
  await startLesson(page);
  await page.getByRole('heading',{name:'A quick recall',exact:true}).waitFor();
  await page.getByLabel('Your answer',{exact:true}).fill('wrong');
  await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,get:()=>400});window.visualViewport.dispatchEvent(new Event('resize'));});
  await page.waitForFunction(()=>document.querySelector('.mobile-chin-page-shell').dataset.keyboard==='true');
  const keyboardAction=await page.getByRole('button',{name:'Check',exact:true}).boundingBox();
  assert.ok(keyboardAction.y+keyboardAction.height<=400,'Lesson actions stay above the system keyboard');
  await page.waitForFunction(()=>{const field=document.querySelector('input[aria-label="Your answer"]'),pane=field.closest('[data-lesson-scroll]');const a=field.getBoundingClientRect(),b=pane.getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;});
  assert.equal(await page.evaluate(()=>scrollY),0,'The keyboard never scrolls the outer lesson document');
  await page.evaluate(()=>window.scrollTo(0,100000));
  assert.equal(await page.evaluate(()=>scrollY),0,'An exercise cannot scroll its action into the status bar');

  await page.evaluate(()=>{delete window.visualViewport.height;window.visualViewport.dispatchEvent(new Event('resize'));});
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Not quite.'}).waitFor();
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await page.getByLabel('Your answer',{exact:true}).fill('the man');await page.getByRole('button',{name:'Check',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Correct.'}).waitFor();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('heading',{name:'Names together',exact:true}).waitFor();
  const deck=await page.evaluate(()=>JSON.parse(localStorage.getItem('coptic-vocabulary:v1')));
  assert.ok(deck.cards.some(card=>card.word==='ⲡⲓⲣⲱⲙⲓ'&&card.lapses===1));
  await finishTransfer(page,next.exerciseSet,{newLesson:true});
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.waitForURL(`${base}/learn/${unit.id}/`);
  await page.getByLabel('Skill mastery').first().waitFor();
  await page.waitForLoadState('networkidle');
  const checkpoint=unit.progressionGroups[0].lessons.find(s=>s.exerciseSet==='bohairic-first-reading-checkpoint');
  await page.goto(`${base}/learn/${unit.id}/play/${checkpoint.id}/`);
  await startLesson(page);
  await page.getByRole('heading',{name:'First reading checkpoint',exact:true}).waitFor();
  await finishTransfer(page,checkpoint.exerciseSet,{newLesson:true});
  await page.waitForLoadState('networkidle');
  await page.screenshot({path:'/tmp/coptic-learning-complete.png',fullPage:true});
  // Replay slowly uses the same audio file at the requested speed.
  await page.addInitScript(()=>{window.__rates=[];const start=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...args){window.__rates.push(this.playbackRate.value);return start.apply(this,args);};});
  await page.goto(base+'/learn/section-1-unit-01-pair-letters-and-sounds/play/lesson-1-a-o-d/');
  await page.getByRole('button',{name:'Play recording slowly',exact:true}).first().click();
  await page.waitForFunction(()=>window.__rates.includes(.75));
  await startLesson(page);
  assert.equal(await page.getByText('Lesson guide',{exact:true}).count(),0);
  await page.getByRole('button',{name:'ⲁ',exact:true}).click();
  await page.getByRole('button',{name:'Check',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Check',exact:true}).waitFor();
  await page.getByRole('button',{name:'a',exact:true}).click();
  await page.getByRole('button',{name:'Check',exact:true}).click();
  const action=await page.getByRole('button',{name:'Continue',exact:true}).boundingBox();
  assert.ok(action.y+action.height<=640, 'The footer stays inside a small phone screen');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),'Small lessons do not scroll offscreen');
  await page.screenshot({path:'/tmp/coptic-learning-lesson.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: integrated noun/name lessons, word-building and gaps, reading help, alternate answers, spaced recall, mistake review, mastery and slow recording playback.');
 }catch(error){console.error("Learning failure snapshot:",(await page.locator("body").innerText()).slice(0,3000));await page.screenshot({path:"/tmp/coptic-learning-failure.png",fullPage:true});throw error;}finally{await context.close();}
}
