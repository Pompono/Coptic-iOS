"use client";
import {useEffect,useState} from 'react';
import Link from '@/lib/AppLink';
import {lessons} from '@/lib/lesson';
import {readCompletedSteps} from './learn/progress';
import {readVocabulary} from '@/lib/vocabulary/store';
import {dueCards} from '@/lib/vocabulary/schedule.mjs';
import {practicePassages} from '@/lib/reading/passages.mjs';
import AppIcon from './AppIcon';

export default function HomePage(){
 const [current,setCurrent]=useState({href:'/learn/',title:'Letters & sounds',step:'Begin your first lesson',completed:0,available:true}),[review,setReview]=useState({saved:0,due:0}),[reading,setReading]=useState('Explore a passage, one word at a time.');
 useEffect(()=>{
  let completed=0,found=false;
  for(const unit of lessons){
   const ids=new Set(readCompletedSteps(unit.id));
   completed+=(unit.progressionGroups??[]).flatMap(g=>g.lessons).filter(s=>s.exerciseSet&&ids.has(s.id)).length;
   if(!found){
    const groups=unit.progressionGroups??[];
    const available=groups.filter(g=>!g.unlockAfterGroupId || (groups.find(p=>p.id===g.unlockAfterGroupId)?.lessons.filter(s=>ids.has(s.id)).length??0)>=(groups.find(p=>p.id===g.unlockAfterGroupId)?.totalLessons??0));
    const group=available.find(g=>g.kind==='lesson-group'&&g.lessons.some(s=>!ids.has(s.id)))??available.find(g=>g.lessons.some(s=>!ids.has(s.id)));
    const step=group?.lessons.find(s=>!ids.has(s.id));
    if(step){found=true;setCurrent({href:step.exerciseSet?`/learn/${unit.id}/play/${step.id}/`:`/learn/${unit.id}/`,title:unit.title.replace(/^Unit \d+: /,''),step:step.exerciseSet?step.summary:'More lessons are being prepared.',completed,available:Boolean(step.exerciseSet)});}
   }
  }
  try{const cards=readVocabulary();setReview({saved:cards.length,due:dueCards(cards,Date.now()).length});}catch{}
  try{const saved=JSON.parse(localStorage.getItem('coptic-reader:v1')??'null');const passage=practicePassages.find(p=>p.id===saved?.passageId);if(passage)setReading(`Resume ${passage.title.toLowerCase()}.`);else if(saved?.passageId==='custom'&&saved.draft?.trim())setReading('Return to your saved passage.');}catch{}
 },[]);
 return <main className="app-page home-page">
  <header className="home-header"><div><span className="eyebrow">READ · LEARN · REMEMBER</span><h1>Coptic</h1></div><span className="home-monogram coptic-text" aria-hidden="true">ⲁ</span></header>
  <section className="home-continue" aria-label="Your learning">
   <div className="eyebrow">{current.available?'YOUR NEXT LESSON':'YOUR LEARNING PATH'}</div><h2>{current.title}</h2><p>{current.step}</p>
   <Link href={current.href} className="ui-primary">{!current.available?'Explore the pathway':current.completed?'Continue learning':'Start learning'}<AppIcon name="arrow"/></Link>
   {current.completed>0&&<p className="home-progress">{current.completed} lessons completed on this device</p>}
  </section>
  <Link href="/vocabulary/" className="home-review"><span className="home-tool-icon"><AppIcon name="review"/></span><span><strong>Vocabulary & review</strong><span>{review.due?`${review.due} words ready to review`:review.saved?`${review.saved} saved words · All caught up`:'Collect words as you read'}</span></span><AppIcon name="chevron" size={16}/></Link>
  <section className="home-library"><div className="section-heading"><h2>Explore the language</h2></div>
   <Link href="/read/" className="home-reader"><AppIcon name="book" size={26}/><span><strong>Read Coptic</strong><span>{reading}</span></span><AppIcon name="arrow"/></Link>
   <div className="home-tools"><Link href="/dictionary/" className="home-tool"><AppIcon name="search"/><strong>Dictionary</strong><span>Find a word</span></Link><Link href="/translator/" className="home-tool"><AppIcon name="translate"/><strong>Translator</strong><span>Text & photos</span></Link></div>
  </section>
  <Link href="/learn/" className="home-path-link">Browse the learning pathway<AppIcon name="arrow" size={16}/></Link>
 </main>;
}
