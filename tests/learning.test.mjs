import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLearning, recordAttempt, learningId, masteryState, dueLearningItems } from '../lib/learning/progress.mjs';
import { loadTsModule } from './tsModule.mjs';
const {getCourseItems,itemsForQuestion,nounItems}=await loadTsModule('lib/learning/content.ts');
const {lessons}=await loadTsModule('lib/lesson.ts');
const item={word:'ⲡⲓⲣⲱⲙⲓ',meaning:'the person',unitId:'unit',explanation:'The article and noun form one phrase.',audio:'/audio/learn/shared/piromi.wav',pos:'Noun phrase'};
const day=86400000;
test('mastery requires spaced first-try successes and retries cannot inflate it',()=>{
 let data=parseLearning(null);
 data=recordAttempt(data,item,true,true,day);
 for(let i=0;i<10;i++)data=recordAttempt(data,item,true,true,day+i);
 assert.equal(data.skills[learningId(item)].successfulDays,1);
 assert.equal(masteryState(data.skills[learningId(item)]),'Building');
 data=recordAttempt(data,item,true,true,day*2);data=recordAttempt(data,item,true,true,day*3);
 assert.equal(masteryState(data.skills[learningId(item)]),'Secure');
 const attempts=data.skills[learningId(item)].attempts;
 data=recordAttempt(data,item,true,false,day*4);
 assert.equal(data.skills[learningId(item)].attempts,attempts);
 assert.equal(data.skills[learningId(item)].successfulDays,3);
 data=recordAttempt(data,item,false,true,day*5);
 assert.equal(masteryState(data.skills[learningId(item)]),'Needs practice');
});
test('mistakes are due after ten minutes and corrected retries retain that due time',()=>{
 let data=recordAttempt(parseLearning(null),item,false,true,10000);
 const id=learningId(item);assert.equal(masteryState(data.skills[id]),'Needs practice');
 data=recordAttempt(data,item,true,false,11000);
 assert.equal(data.skills[id].dueAt,610000);
 assert.equal(dueLearningItems(data,[id],10000).length,0);
 assert.equal(dueLearningItems(data,[id],610000).length,1);
 assert.equal(dueLearningItems(data,[],610000).length,0);
 assert.equal(data.skills[id].explanation,item.explanation);
 assert.throws(()=>parseLearning('{broken'));
 assert.throws(()=>parseLearning(JSON.stringify({version:1,skills:{bad:{word:'x'}}})));
});
test('every authored course lesson supplies real learning items without creating placeholder content',()=>{
 for(const step of lessons.flatMap(l=>l.progressionGroups??[]).flatMap(g=>[...g.lessons,...(g.reviewStep?[g.reviewStep]:[])]).filter(s=>s.exerciseSet)){
  const items=getCourseItems(step.exerciseSet);
  assert.ok(items.length,step.exerciseSet);
  for(const item of items){assert.match(item.word,/[\u2c80-\u2cff\u03e2-\u03ef]/u);assert.ok(item.meaning&&item.explanation);}
 }
 assert.equal(lessons.filter(l=>l.isPlaceholder).length,45);
 assert.ok(nounItems[0].accepted.includes('the man'));
 assert.equal(getCourseItems('bohairic-first-reading-checkpoint').length,6);
 const match=itemsForQuestion({kind:'matching-pairs',pairs:[{left:'a',right:'ⲁ'}]})[0];
 assert.equal(match.word,'ⲁ');assert.equal(match.meaning,'Sound: a');
});
