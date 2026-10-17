"use client";
import AudioReplay from "@/app/AudioReplay";
import {lessonActionPressHandlers} from '@/lib/inputFocus';
import AppIcon from "@/app/AppIcon";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from '@/lib/AppLink';
import { useRouter } from 'next/navigation';
import { resultFeedback } from "@/lib/nativeExperience";
import { audioService, reportAudioFailure } from '@/lib/audioService';
import { resolveLessonAudio } from '@/lib/lessonAudio';
import { readRecord, writeRecord } from "@/lib/progressStorage";
import { clearStepFailed, markStepCompleted } from '../progress';
import { createCard, gradeCard, cardId } from '@/lib/vocabulary/schedule.mjs';
import { readVocabulary, writeVocabulary } from '@/lib/vocabulary/store';
import { LEARNING_KEY, parseLearning, recordAttempt, learningId, dueLearningItems } from '@/lib/learning/progress.mjs';
import { getCourseItems, itemsForQuestion, lessonNote, type LearningItem } from '@/lib/learning/content';
import { loadReadingDictionary } from '@/lib/reading/dictionary';
import { makeWordIndex, lookupWord } from '@/lib/reading/text.mjs';
import type { DictionaryEntry } from '@/lib/dictionary';
import type { Lesson, UnitLessonStep } from '@/lib/lesson';
import styles from './learning.module.css';
import LessonCelebration from './LessonCelebration';

type Session = { record: (id: string, items: LearningItem[], correct: boolean, assisted?: boolean) => void; finish: (total: number) => void; progress: (completed: number, total: number) => number; error: string; };
const SessionContext = createContext<Session>({ record: () => {}, finish: () => {}, progress: (completed, total) => total ? completed / total : 0, error: '' });
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
  const [celebrationPlaying, setCelebrationPlaying] = useState(false);
  const [celebrationDuration, setCelebrationDuration] = useState(2200);
  const returnToUnit = useCallback(()=>router.replace(`/learn/${lesson.id}/`),[router,lesson.id]);
  const attempts = useRef(new Set<string>());
  const guideContent = useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});guideContent.current?.scrollTo({top:0,left:0,behavior:'instant'});},[phase,step.id]);
  const items = useMemo(() => getCourseItems(step.exerciseSet ?? ''), [step.exerciseSet]);
  useEffect(() => {
    try {
      const progress = (readRecord(LEARNING_KEY) ?? parseLearning(null));
      const due = dueLearningItems(progress, Object.keys(progress.skills)).map(skill => ({...skill, explanation:skill.explanation ?? 'Read the complete expression and compare it with the meaning you learned.'}));
      setReviews(due); setCelebrationPlaying(false); setPhase('guide');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Learning progress could not be loaded.'); setPhase('guide'); }
  }, [step.id, newLesson]);
  const record = (id: string, concepts: LearningItem[], correct: boolean, assisted = false) => {
    const initialAttempt = !attempts.current.has(id);
    const firstTry = initialAttempt && !assisted; attempts.current.add(id);
    if (initialAttempt) void resultFeedback(correct);
    try {
      let latest = (readRecord(LEARNING_KEY) ?? parseLearning(null));
      for (const item of concepts) latest = recordAttempt(latest, {...item, unitId:item.unitId ?? lesson.id}, correct, firstTry);
      writeRecord(LEARNING_KEY, latest);
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
  const [lessonCount, setLessonCount] = useState(0);
  const extraCount = Math.min(3, items.length);
  const progress = (completed: number, total: number) => Math.max(0.08, completed / Math.max(1, total + extraCount));
  const finish = (total: number) => { setLessonCount(total); setPhase('transfer'); };
  const complete = () => {
    try {
      clearStepFailed(lesson.id,step.id);
      markStepCompleted(lesson.id,step.id);
      setPhase('complete');
      const celebration = resolveLessonAudio('', 'lesson-complete');
      if (celebration?.src) void audioService.play(celebration.src,celebration.src)
        .then(playback=>{
          const duration = playback.buffer?.duration;
          if(typeof duration==='number'&&Number.isFinite(duration))setCelebrationDuration(Math.max(2200,duration*1000));
          setCelebrationPlaying(true);
        })
        .catch(failure=>{reportAudioFailure(failure);setCelebrationPlaying(true);});
      else setCelebrationPlaying(true);
    }
    catch { setError('Could not save lesson completion. Please try again.'); }
  };
  return <SessionContext.Provider value={{record,finish,progress,error}}>
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
      : phase === 'transfer' ? <LearningPractice key="transfer" progressOffset={lessonCount} items={items} lesson={lesson} title={newLesson ? step.title : 'Put it together'} description={newLesson ? step.summary : 'Read what you have learned, then try it in a different way.'} onDone={complete} teaching={newLesson && !/checkpoint/.test(step.exerciseSet ?? '')} checkpoint={/checkpoint/.test(step.exerciseSet ?? '')} />
      : <LessonCelebration playing={celebrationPlaying} duration={celebrationDuration} error={error} onComplete={returnToUnit}/>}
  </SessionContext.Provider>;
}

function LearningPractice({ items, lesson, title, description, onDone, review = false, teaching = false, checkpoint = false, progressOffset = 0 }: { progressOffset?:number; items:LearningItem[]; lesson:Lesson; title:string; description:string; onDone:()=>void; review?:boolean; teaching?:boolean; checkpoint?:boolean }) {
  const session = useLearningSession();
  const [dictionary,setDictionary] = useState<DictionaryEntry[]>([]);
  useEffect(()=>{let cancelled=false;loadReadingDictionary().then(entries=>{if(!cancelled)setDictionary(entries);}).catch(()=>{});return()=>{cancelled=true;};},[]);
  const wordIndex = useMemo(()=>makeWordIndex(dictionary),[dictionary]);
  const [index,setIndex] = useState(0), [reading,setReading] = useState(teaching || checkpoint), [selected,setSelected] = useState<number|null>(null);
  const [answer,setAnswer] = useState(''), [result,setResult] = useState<'idle'|'correct'|'wrong'>('idle');
  const [bank,setBank] = useState<number[]>([]);
  const practiceContent = useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});practiceContent.current?.scrollTo({top:0,left:0,behavior:'instant'});},[index,reading]);
  const selectedEntries = selected === null ? [] : [...new Map(items[selected].word.split(' ').flatMap(word=>{const found=lookupWord(wordIndex,word);return [...found.matches,...found.analyses.flatMap(analysis=>analysis.entries)];}).map(entry=>[entry.id,entry])).values()] as DictionaryEntry[];
  const count = checkpoint ? items.length : teaching ? items.length * 3 : Math.min(3,items.length);
  const progress = Math.max(0.08, (progressOffset + (reading ? 0 : index + (result === 'correct' ? 1 : 0))) / Math.max(1, progressOffset + count));
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
    if(document.activeElement instanceof HTMLInputElement)document.activeElement.blur();
    const actual = kind === 'build' ? bank.map(i=>bankWords[i]).join(joined ? '' : ' ') : answer;
    const accepted = kind === 'recall' ? [plainMeaning(item),...(item.accepted ?? [])] : [expected];
    const correct = accepted.some(value => normalizeAnswer(actual) === normalizeAnswer(value));
    session.record(`${review?'review':'transfer'}:${index}:${learningId(item)}`, [item], correct);
    const feedback = resolveLessonAudio('',correct ? 'correct-answer' : 'incorrect-answer');
    if(feedback?.src)void audioService.play(feedback.src,feedback.src).catch(reportAudioFailure);
    setResult(correct ? 'correct' : 'wrong');
  };
  const next = () => {
    if (result === 'wrong') { setResult('idle'); setAnswer(''); setBank([]); return; }
    if (index + 1 >= count) { onDone(); return; }
    setIndex(i=>i+1); setResult('idle'); setAnswer(''); setBank([]);
  };
  if (!items.length) return <main className={styles.screen}><div className={styles.inner}><p>This lesson’s practice is ready.</p><button className={styles.primary} onClick={onDone}>Continue</button></div></main>;
  return <main className={`${styles.screen} ${styles.practiceScreen}`}><div className={styles.practiceLayout}><header className={styles.practiceHeader}>
    <Link className={styles.close} href={`/learn/${lesson.id}/`} aria-label="Close lesson"><AppIcon name="close" size={24}/></Link>
    <div className={`lesson-progress-track ${styles.progress}`} role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
      <div style={{width:`${progress * 100}%`}} />
    </div>
    </header><div ref={practiceContent} className={styles.practiceContent} data-lesson-scroll>
    {reading && <><h1>{title}</h1><p className={styles.muted}>{description}</p></>}
    {reading ? <>
      <p>{items.every(i=>i.pos === 'Letter / syllable') ? 'Read these sound patterns from left to right. Tap a pattern to check its sound label.' : 'These are short practice phrases. Tap a word or phrase to see how it works.'}</p>
      <div className={styles.reading}>{items.slice(0, teaching || checkpoint ? 6 : 3).map((entry,i)=><button key={learningId(entry)} className="coptic-text" aria-pressed={selected===i} onClick={()=>setSelected(i)}>{entry.word}</button>)}</div>
      {selected !== null && <div className={styles.panel}><p>{items[selected].meaning}</p><p>{items[selected].explanation}</p><AudioReplay path={items[selected].audio} />{selectedEntries.slice(0,3).map(entry=><div key={entry.id}><p>Dictionary headword: <span className="coptic-text">{entry.lemma}</span></p><p>{entry.gloss.join('; ')}</p>{entry.forms.length>1&&<p>Listed forms: <span className="coptic-text">{entry.forms.filter(form=>form!==entry.lemma).join(', ')}</span></p>}<Link className={styles.entryLink} href={`/dictionary/entry/?lemma=${encodeURIComponent(entry.lemma)}`}>Dictionary details</Link></div>)}</div>}

    </> : <>
      <div className={styles.instruction}><h1>{kind === 'build' ? 'Build the Coptic phrase' : kind === 'gap' ? 'Fill the missing letter' : listening ? 'Listen and translate' : item.pos === 'Letter / syllable' ? 'What sound does this make?' : 'Translate this phrase'}</h1>{item.audio && <AudioReplay path={item.audio}/>}</div>
      {kind === 'build' ? <><p>{plainMeaning(item)}</p><div className={styles.bank} role="group" aria-label="Your assembled phrase">{bank.map((i,n)=><button key={n} className="coptic-text" disabled={result!=='idle'} onClick={()=>setBank(list=>list.filter((_,at)=>at!==n))}>{bankWords[i]}</button>)}</div>
        <div className={styles.bank} role="group" aria-label="Available phrase pieces">{bankWords.map((word,i)=><button key={i} className="coptic-text" disabled={result!=='idle'||bank.includes(i)} onClick={()=>setBank(list=>[...list,i])}>{word}</button>)}</div></>
        : <>{listening ? <p>Listen to the recording, then write its meaning.</p> : <button type="button" className={`coptic-text ${styles.prompt}`} disabled={!item.audio} aria-label={`Play recording: ${kind==='gap' ? 'phrase with missing letter' : item.word}`} onClick={()=>{if(item.audio)void audioService.play(item.audio,item.audio,1).catch(reportAudioFailure);}}>{kind==='gap' ? gapParts.map((ch,i)=>i===gapIndex?'＿':ch).join('') : item.word}</button>}
          {kind==='gap' && <p>{plainMeaning(item)}</p>}
          <label className={styles.label}>{kind === 'gap' ? 'Missing letter' : 'Your answer'}<input aria-label={kind==='gap'?'Missing letter':'Your answer'} value={answer} disabled={result!=='idle'} onChange={e=>setAnswer(e.target.value)} onKeyDown={e=>{if(e.key==='Enter' && answer.trim() && result==='idle'){e.currentTarget.blur();check();}}} enterKeyHint="done" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
          {kind==='gap' && <div className={styles.bank}>{[...new Set([...gapParts,'ⲉ','ⲟ'])].filter(ch=>ch!==' ').map(ch=><button key={ch} className="coptic-text" disabled={result!=='idle'} onClick={()=>setAnswer(ch)}>{ch}</button>)}</div>}
        </>}
      {result!=='idle' && <div role="status" className={styles.panel}><p>{result==='correct'?'Correct.':`Not quite. ${expected}`}</p><p>{item.explanation}</p></div>}
      {session.error && <p role="alert">{session.error}</p>}
    </>}
  </div><footer className={styles.practiceFooter}><button type="button" className={styles.primary} disabled={!reading&&result==='idle'&&!(kind==='build'?bank.length:answer.trim())} {...lessonActionPressHandlers} onClick={reading?()=>{setReading(false);setSelected(null);}:result==='idle'?check:next}>{reading?'Continue':result==='idle'?'Check':result==='wrong'?'Try again':'Continue'}</button></footer></div></main>;
}
