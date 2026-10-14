import assert from 'node:assert/strict';
import {loadTsModule} from '../tests/tsModule.mjs';
import {startLesson} from './learning-smoke.mjs';
const {lessons}=await loadTsModule('lib/lesson.ts');
const {LESSON_EXERCISE_SETS}=await loadTsModule('lib/learning/letterExercises.ts');
const choicesVisible=page=>page.evaluate(()=>[...document.querySelectorAll('.lesson-option-button')].every(el=>{const a=el.getBoundingClientRect();let p=el.parentElement;while(p&&p.tagName!=='MAIN'){if(['auto','hidden','scroll'].includes(getComputedStyle(p).overflowY)){const b=p.getBoundingClientRect();if(a.top<b.top-1||a.bottom>b.bottom+1)return false;}p=p.parentElement;}return true;}));
export async function checkLessonLayouts(browser,base){
 const context=await browser.newContext({viewport:{width:393,height:852}}),page=await context.newPage();
 try{
  const unit=lessons[0],step=unit.progressionGroups.flatMap(g=>g.lessons).find(s=>{
   const list=LESSON_EXERCISE_SETS[s.exerciseSet];return list&&list.every(q=>q.kind!=='matching-pairs')&&list.some(q=>q.kind==='hear-and-choose'&&q.choices.length===3);
  });
  assert.ok(step,'A real three-choice listening lesson is available');
  const questions=LESSON_EXERCISE_SETS[step.exerciseSet];
  await page.goto(`${base}/learn/${unit.id}/play/${step.id}/`);await startLesson(page);
  // Reproduce an iPhone's status and home-indicator insets, not only its screen size.
  await page.evaluate(()=>{const shell=document.querySelector('.mobile-chin-page-shell');shell.style.paddingTop='59px';shell.style.paddingBottom='34px';shell.style.setProperty('--page-content-height','calc(var(--interactive-viewport-height,100svh) - 93px)');});
  const retry=questions.find(q=>q.choices.length===3);
  const queue=[...questions,retry];
  for(let i=0;i<queue.length;i++){
   const q=queue[i];await page.getByRole('button',{name:'Check',exact:true}).waitFor();await page.waitForTimeout(250);
   if(q.choices.length===3){
    const boxes=await Promise.all(q.choices.map(c=>page.getByRole('button',{name:c,exact:true}).boundingBox()));
    assert.ok(boxes.every(b=>Math.abs(b.x-boxes[0].x)<1&&Math.abs(b.width-boxes[0].width)<1),'Three choices form one equal-width stack');
    assert.ok(boxes.every(b=>b.y>=59&&b.y+b.height<=852-34),'Every choice fits above the home indicator');
    const shown=await choicesVisible(page);
    if(!shown){console.log('Question',q.id,q.kind,q.choices);console.log(await page.locator('.lesson-option-button').evaluateAll(els=>els.map(el=>{const a=el.getBoundingClientRect();return {text:el.textContent,top:a.top,bottom:a.bottom,parent:el.parentElement.getBoundingClientRect().toJSON()};})));await page.screenshot({path:'/tmp/coptic-stack-failure.png'});}
    assert.ok(shown,'Choice corners are not clipped by a scrolling ancestor');
   }
   if(i===questions.length){const badge=await page.locator('.lesson-retry-context').boundingBox();const card=await page.locator('.recording-card').boundingBox();assert.ok(badge.y<120&&card.y<260,'Retry status stays in the progress header');}
   const answer=i<questions.length&&q.id===retry.id?q.choices.find(c=>c!==q.answer):q.answer;
   await page.getByRole('button',{name:answer,exact:true}).click();await page.getByRole('button',{name:'Check',exact:true}).click();
   await page.getByRole('button',{name:'Continue',exact:true}).waitFor();
   if(q.choices.length===3)assert.ok(await choicesVisible(page),'Three choices remain visible with correct/incorrect feedback');
   await page.getByRole('button',{name:'Continue',exact:true}).click();
  }
  console.log('PASS: three-choice listening/sound stacks and real mistake-retry layouts with iPhone safe areas.');
 }finally{await context.close();}
}
