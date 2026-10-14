"use client";
import AudioReplay from "@/app/AudioReplay";
import AppIcon from "@/app/AppIcon";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from '@/lib/AppLink';
import { useRouter } from 'next/navigation';
import { resultFeedback } from "@/lib/nativeExperience";
import { audioService, reportAudioFailure } from '@/lib/audioService';
import { resolveLessonAudio } from '@/lib/lessonAudio';
import { clearStepFailed, markStepCompleted } from '../progress';
import { createCard, gradeCard, cardId } from '@/lib/vocabulary/schedule.mjs';
import { readVocabulary, writeVocabulary } from '@/lib/vocabulary/store';
import { LEARNING_KEY, parseLearning, recordAttempt, learningId, dueLearningItems, masteryState } from '@/lib/learning/progress.mjs';
import { getCourseItems, itemsForQuestion, lessonNote, type LearningItem } from '@/lib/learning/content';
import { loadReadingDictionary } from '@/lib/reading/dictionary';
import { makeWordIndex, lookupWord } from '@/lib/reading/text.mjs';
import type { DictionaryEntry } from '@/lib/dictionary';
import type { Lesson, UnitLessonStep } from '@/lib/lesson';
import styles from './learning.module.css';

type Session = { record: (id: string, items: LearningItem[], correct: boolean, assisted?: boolean) => void; finish: () => void; error: string; };
const SessionContext = createContext<Session>({ record: () => {}, finish: () => {}, error: '' });
export const useLearningSession = () => useContext(SessionContext);
export function LessonExplanation({ question, wrong }: { question: any; wrong: boolean }) {
  const session = useLearningSession();
  const items = itemsForQuestion(question);
  return <>{wrong && items[0] && <p className={styles.explanation}>{items[0].explanation}</p>}{session.error && <p role="alert" className={styles.error}>{session.error}</p>}</>;
}

function normalizeAnswer(text: string) { return text.normalize('NFKC').trim().toLowerCase().replace(/[.!?,:;]+$/u,'').replace(/\s+/gu,' '); }
function plainMeaning(item: LearningItem) { return item.meaning.replace(/^Sound: /,''); }

export function LearningSession({ lesson, step, children, newLesson = false }: { lesson: Lesson; step: UnitLessonStep; children?: ReactNode; newLesson?: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading'|'guide'|'review'|'lesson'|'transfer'|'complete'>('loading');
  const [reviews, setReviews] = useState<LearningItem[]>([]);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>({version:1,skills:{}});
  const attempts = useRef(new Set<string>());
  const guideContent = useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});guideContent.current?.scrollTo({top:0,left:0,behavior:'instant'});},[phase,step.id]);
  const items = useMemo(() => getCourseItems(step.exerciseSet ?? ''), [step.exerciseSet]);
  useEffect(() => {
    try {
      const progress = parseLearning(localStorage.getItem(LEARNING_KEY)); setData(progress);
      const due = dueLearningItems(progress, Object.keys(progress.skills)).map(skill => ({...skill, explanation:skill.explanation ?? 'Read the complete expression and compare it with the meaning you learned.'}));
      setReviews(due); setPhase('guide');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Learning progress could not be loaded.'); setPhase('guide'); }
  }, [step.id, newLesson]);
  const record = (id: string, concepts: LearningItem[], correct: boolean, assisted = false) => {
    const initialAttempt = !attempts.current.has(id);
    const firstTry = initialAttempt && !assisted; attempts.current.add(id);
    if (initialAttempt) void resultFeedback(correct);
    try {
      let latest = parseLearning(localStorage.getItem(LEARNING_KEY));
      for (const item of concepts) latest = recordAttempt(latest, {...item, unitId:item.unitId ?? lesson.id}, correct, firstTry);
      localStorage.setItem(LEARNING_KEY,JSON.stringify(latest)); setData(latest);
      window.dispatchEvent(new Event('coptic-learning-change'));
      const cards = readVocabulary(); let changed = false;
      for (const item of concepts) {
        const meaning = item.meaning, id = cardId(item.word,meaning,item.pos,'bohairic');
        const position = cards.findIndex(card => card.id === id);
        if (!correct && initialAttempt) {
          const card = position >= 0 ? cards[position] : createCard({word:item.word,meaning,pos:item.pos,dialect:'bohairic',audio:item.audio ?? '',source:`Lesson: ${lesson.title}`,context:item.explanation});
          const graded = gradeCard(card,'again');
          if (position >= 0) cards[position] = graded; else cards.push(graded); changed = true;
        } else if (correct && firstTry && position >= 0 && cards[position].dueAt <= Date.now()) { cards[position] = gradeCard(cards[position],'good'); changed = true; }
      }
      if (changed) writeVocabulary(cards);
      setError('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save this practice result.'); }
  };
  const finish = () => { setPhase('transfer'); };
  const complete = () => {
    try { clearStepFailed(lesson.id,step.id); markStepCompleted(lesson.id,step.id); setPhase('complete'); }
    catch { setError('Could not save lesson completion. Please try again.'); }
  };
  const summary = items.map(item => ({...item,state:masteryState(data.skills[learningId(item)])}));
  return <SessionContext.Provider value={{record,finish,error}}>
    {phase === 'loading' ? <main className={styles.screen}><p>Preparing your lesson…</p></main>
      : phase === 'guide' ? <main className={styles.introScreen}>
        <div ref={guideContent} className={styles.introBody} data-lesson-scroll>
          <div className={styles.top}><Link href={`/learn/${lesson.id}/`}><AppIcon name="close" size={16}/>Close lesson</Link><span>Lesson guide</span></div>
          <h1>{step.title}</h1>
          <p>{lessonNote(step)}</p>
          <div className={styles.skills}>{items.slice(0,3).map(item => <div key={learningId(item)}>
            <div><span className="coptic-text">{item.word}</span><p>{plainMeaning(item)}</p></div>
            {item.audio && <AudioReplay path={item.audio} />}
          </div>)}</div>
          {error && <p role="alert">{error}</p>}
        </div>
        <div className={styles.introFooter}><button className={styles.primary} onClick={() => { audioService.stopAll(); setPhase(reviews.length ? 'review' : newLesson ? 'transfer' : 'lesson'); }}>I’m ready</button></div>
      </main>
      : phase === 'lesson' ? children
      : phase === 'review' ? <LearningPractice key="review" items={reviews} lesson={lesson} title="A quick recall" description="A few things from earlier lessons are ready for another try. Then you’ll continue into this lesson." onDone={() => setPhase(newLesson ? 'transfer' : 'lesson')} review />
      : phase === 'transfer' ? <LearningPractice key="transfer" items={items} lesson={lesson} title={newLesson ? step.title : 'Put it together'} description={newLesson ? step.summary : 'Read what you have learned, then try it in a different way.'} onDone={complete} teaching={newLesson && !/checkpoint/.test(step.exerciseSet ?? '')} checkpoint={/checkpoint/.test(step.exerciseSet ?? '')} />
      : <main className={`lesson-outcome-screen ${styles.screen}`}><div className={styles.inner}><h1>Lesson complete</h1><p>You practised {items.length} {items.some(i => i.pos !== 'Letter / syllable') ? 'words and phrases' : 'sound patterns'}.</p>
        <div className={styles.skills}>{summary.map(item => <div key={learningId(item)}><span className="coptic-text">{item.word}</span><span>{item.state}</span></div>)}</div>
        <p className={styles.muted}>Secure means consistent first-try recall across at least three different days. Difficult items will return in later lessons and your review queue.</p>
        {error && <p role="alert">{error}</p>}<button className={styles.primary} onClick={() => router.replace(`/learn/${lesson.id}/`)}>Continue</button></div></main>}
  </SessionContext.Provider>;
}

function LearningPractice({ items, lesson, title, description, onDone, review = false, teaching = false, checkpoint = false }: { items:LearningItem[]; lesson:Lesson; title:string; description:string; onDone:()=>void; review?:boolean; teaching?:boolean; checkpoint?:boolean }) {
  const session = useLearningSession();
  const [dictionary,setDictionary] = useState<DictionaryEntry[]>([]);
  useEffect(()=>{let cancelled=false;loadReadingDictionary().then(entries=>{if(!cancelled)setDictionary(entries);}).catch(()=>{});return()=>{cancelled=true;};},[]);
  const wordIndex = useMemo(()=>makeWordIndex(dictionary),[dictionary]);
  const [index,setIndex] = useState(0), [reading,setReading] = useState(!review), [selected,setSelected] = useState<number|null>(null);
  const [answer,setAnswer] = useState(''), [result,setResult] = useState<'idle'|'correct'|'wrong'>('idle');
  const [bank,setBank] = useState<number[]>([]), [hint,setHint] = useState(false);
  const practiceContent = useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});practiceContent.current?.scrollTo({top:0,left:0,behavior:'instant'});},[index,reading]);
  const selectedEntries = selected === null ? [] : [...new Map(items[selected].word.split(' ').flatMap(word=>{const found=lookupWord(wordIndex,word);return [...found.matches,...found.analyses.flatMap(analysis=>analysis.entries)];}).map(entry=>[entry.id,entry])).values()] as DictionaryEntry[];
  const count = checkpoint ? items.length : teaching ? items.length * 3 : Math.min(3,items.length);
  const item = items[index % items.length];
  const kind = review ? 'recall' : checkpoint ? index % 3 === 0 ? 'build' : index % 3 === 1 ? 'gap' : 'recall' : teaching ? Math.floor(index / items.length) % 3 === 0 ? 'build' : Math.floor(index / items.length) % 3 === 1 ? 'gap' : 'recall' : 'recall';
  const joined = item?.word && !item.word.includes(' ');
  const listening = checkpoint && kind === 'recall' && Boolean(item?.audio);
  const words = joined ? item.word.startsWith('ⲡⲓ') ? ['ⲡⲓ',item.word.slice(2)] : Array.from(item.word) : item?.word.split(' ') ?? [];
  const bankWords = [...words].reverse();
  const gapParts = Array.from(item?.word ?? '');
  const gapIndex = Math.max(0, gapParts.length-2);
  const expected = kind === 'build' ? item?.word ?? '' : kind === 'gap' ? gapParts[gapIndex] : plainMeaning(item);
  const check = () => {
    const actual = kind === 'build' ? bank.map(i=>bankWords[i]).join(joined ? '' : ' ') : answer;
    const accepted = kind === 'recall' ? [plainMeaning(item),...(item.accepted ?? [])] : [expected];
    const correct = accepted.some(value => normalizeAnswer(actual) === normalizeAnswer(value));
    session.record(`${review?'review':'transfer'}:${index}:${learningId(item)}`, [item], correct, hint);
    const feedback = resolveLessonAudio('',correct ? 'correct-answer' : 'incorrect-answer');
    if(feedback?.src)void audioService.play(feedback.src,feedback.src).catch(reportAudioFailure);
    setResult(correct ? 'correct' : 'wrong');
  };
  const next = () => {
    if (result === 'wrong') { setResult('idle'); setAnswer(''); setBank([]); return; }
    if (index + 1 >= count) { onDone(); return; }
    setIndex(i=>i+1); setResult('idle'); setAnswer(''); setBank([]); setHint(false);
  };
  if (!items.length) return <main className={styles.screen}><div className={styles.inner}><p>This lesson’s practice is ready.</p><button className={styles.primary} onClick={onDone}>Continue</button></div></main>;
  return <main className={`${styles.screen} ${styles.practiceScreen}`}><div className={styles.practiceLayout}><header className={styles.practiceHeader}>
    <div className={styles.top}><Link href={`/learn/${lesson.id}/`}><AppIcon name="close" size={16}/>Close lesson</Link><div className={styles.practiceTools}><button className={styles.keyboardDone} onClick={()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();}}>Done</button><span>{reading ? 'Read' : `${index+1} of ${count}`}</span></div></div>
    <progress className={styles.progress} value={reading?0:index+1} max={count} aria-label="Practice progress"/>
    <h1>{title}</h1><p className={styles.muted}>{description}</p>
    </header><div ref={practiceContent} className={styles.practiceContent} data-lesson-scroll>
    {reading ? <>
      <p>{items.every(i=>i.pos === 'Letter / syllable') ? 'Read these sound patterns from left to right. Tap a pattern to check its sound label.' : 'These are short practice phrases. Tap a word or phrase to see how it works.'}</p>
      <div className={styles.reading}>{items.slice(0, teaching || checkpoint ? 6 : 3).map((entry,i)=><button key={learningId(entry)} className="coptic-text" aria-pressed={selected===i} onClick={()=>setSelected(i)}>{entry.word}</button>)}</div>
      {selected !== null && <div className={styles.panel}><p>{items[selected].meaning}</p><p>{items[selected].explanation}</p><AudioReplay path={items[selected].audio} />{selectedEntries.slice(0,3).map(entry=><div key={entry.id}><p>Dictionary headword: <span className="coptic-text">{entry.lemma}</span></p><p>{entry.gloss.join('; ')}</p>{entry.forms.length>1&&<p>Listed forms: <span className="coptic-text">{entry.forms.filter(form=>form!==entry.lemma).join(', ')}</span></p>}<Link className={styles.entryLink} href={`/dictionary/entry/?lemma=${encodeURIComponent(entry.lemma)}`}>Dictionary details</Link></div>)}</div>}

    </> : <>
      <div className={styles.instruction}><h2>{kind === 'build' ? 'Build the Coptic phrase' : kind === 'gap' ? 'Fill the missing letter' : listening ? 'Listen and translate' : item.pos === 'Letter / syllable' ? 'Write the sound label' : 'Translate this phrase'}</h2>{item.audio && <AudioReplay path={item.audio}/>}</div>
      {kind === 'build' ? <><p>{plainMeaning(item)}</p><div className={styles.bank} role="group" aria-label="Your assembled phrase">{bank.map((i,n)=><button key={n} className="coptic-text" disabled={result!=='idle'} onClick={()=>setBank(list=>list.filter((_,at)=>at!==n))}>{bankWords[i]}</button>)}</div>
        <div className={styles.bank} role="group" aria-label="Available phrase pieces">{bankWords.map((word,i)=><button key={i} className="coptic-text" disabled={result!=='idle'||bank.includes(i)} onClick={()=>setBank(list=>[...list,i])}>{word}</button>)}</div></>
        : <>{listening ? <p>Listen to the recording, then write its meaning.</p> : <p className={`coptic-text ${styles.prompt}`}>{kind==='gap' ? gapParts.map((ch,i)=>i===gapIndex?'＿':ch).join('') : item.word}</p>}
          {kind==='gap' && <p>{plainMeaning(item)}</p>}
          <label className={styles.label}>{kind === 'gap' ? 'Missing letter' : 'Your answer'}<input aria-label={kind==='gap'?'Missing letter':'Your answer'} value={answer} disabled={result!=='idle'} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>{if(e.key==='Enter' && answer.trim() && result==='idle'){e.currentTarget.blur();check();}}} enterKeyHint="done" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
          {kind==='gap' && <div className={styles.bank}>{[...new Set([...gapParts,'ⲉ','ⲟ'])].filter(ch=>ch!==' ').map(ch=><button key={ch} className="coptic-text" disabled={result!=='idle'} onClick={()=>setAnswer(ch)}>{ch}</button>)}</div>}
        </>}
      {(review||(teaching&&kind!=='recall')) && result==='idle' && <button className={styles.hint} onClick={()=>setHint(true)}>Show a hint</button>}
      {hint && result==='idle' && <p>{item.explanation}</p>}
      {result!=='idle' && <div role="status" className={styles.panel}><p>{result==='correct'?'Correct.':`Not quite. ${expected}`}</p><p>{item.explanation}</p></div>}
      {session.error && <p role="alert">{session.error}</p>}
    </>}
  </div><footer className={styles.practiceFooter}><button className={styles.primary} disabled={!reading&&result==='idle'&&!(kind==='build'?bank.length:answer.trim())} onClick={reading?()=>{setReading(false);setSelected(null);}:result==='idle'?check:next}>{reading?'Continue':result==='idle'?'Check':result==='wrong'?'Try again':'Continue'}</button></footer></div></main>;
}
