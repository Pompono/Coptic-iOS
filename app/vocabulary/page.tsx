"use client";
import AudioReplay from "../AudioReplay";
import DelayedStatus from '../DelayedStatus';
import PageHeader, { PageBackLink } from "../PageHeader";
import { useEffect, useMemo, useState } from 'react';
import Link from '@/lib/AppLink';
import { dueCards, gradeCard } from '@/lib/vocabulary/schedule.mjs';
import { readVocabulary, writeVocabulary, type VocabularyCard } from '@/lib/vocabulary/store';
import styles from '../reading.module.css';

export default function VocabularyPage() {
  const [cards, setCards] = useState<VocabularyCard[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [mode, setMode] = useState<'recall' | 'quiz'>('recall');
  const [choice, setChoice] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(0);
  useEffect(() => {
    const refresh = () => {
      try { setCards(readVocabulary()); setError(''); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not load saved vocabulary.'); }
      setNow(Date.now()); setReady(true);
    };
    refresh();
    const timer = setInterval(() => setNow(Date.now()), 30000);
    window.addEventListener('storage', refresh);
    return () => { clearInterval(timer); window.removeEventListener('storage', refresh); };
  }, []);
  const due = useMemo(() => dueCards(cards, now), [cards, now]);
  const current = due[0] as VocabularyCard | undefined;
  useEffect(() => { setRevealed(false); setChoice(null); }, [current?.id]);
  const choices = useMemo(() => {
    if (!current) return [];
    const meanings = [current.meaning, ...cards.filter(card => card.id !== current.id).map(card => card.meaning)];
    const unique = [...new Set(meanings)].slice(0, 4);
    // Stable order within one card; rotate the correct answer's position.
    const offset = [...current.word].reduce((sum, letter) => sum + letter.codePointAt(0)!, 0) % unique.length;
    return [...unique.slice(offset), ...unique.slice(0, offset)];
  }, [current?.id, cards]);
  function rate(rating: string) {
    if (!current) return;
    try {
      // Reload before writing so saving a word in another tab is preserved.
      const latest = readVocabulary();
      const latestCard = latest.find(card => card.id === current.id);
      if (!latestCard || latestCard.dueAt > Date.now()) {
        setCards(latest); setNow(Date.now()); setRevealed(false); setChoice(null);
        return;
      }
      const updated = latest.map(card => card.id === current.id ? gradeCard(card, rating) : card);
      writeVocabulary(updated); setCards(updated); setNow(Date.now());
      setReviewed(count => count + 1); setRevealed(false); setChoice(null); setError('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Review could not be saved.'); }
  }
  return <main className={styles.shell}>
    <PageBackLink href="/read/">Read Coptic</PageBackLink>
    <PageHeader title="Vocabulary & review" icon="review"/>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!ready ? <DelayedStatus>Loading saved words…</DelayedStatus> : <>
      <p className={styles.muted}>{cards.length} saved · {due.length} due · {reviewed} reviewed this session</p>
      {!cards.length && <div className={styles.panel}><h2>Start with a word</h2><p>Open a passage, tap a word, and save its dictionary meaning.</p><Link className={styles.link} href="/read/">Open the reader →</Link></div>}
      {current ? <section className={styles.panel} aria-label="Vocabulary review">
        <div className={styles.segmented} role="group" aria-label="Review mode"><button aria-pressed={mode === 'recall'} onClick={() => { setMode('recall'); setChoice(null); setRevealed(false); }}>Recall</button>
          <button aria-pressed={mode === 'quiz'} disabled={choices.length < 2} onClick={() => { setMode('quiz'); setChoice(null); setRevealed(false); }}>Meaning quiz</button></div>
        <p className={styles.muted}>{current.dialect === 'bohairic' ? 'Bohairic' : 'Dialect not specified'} · {current.pos || 'Dictionary word'}{current.lapses > 0 ? ` · ${current.lapses} difficult reviews` : ''}</p>
        <h2 className={`${styles.word} coptic-text`}>{current.word}</h2>
        {current.audio && <AudioReplay path={current.audio}/>}
        {mode === 'recall' ? <>
          {!revealed ? <button className={styles.primary} onClick={() => setRevealed(true)}>Reveal meaning</button>
            : <><p className={styles.answer}>{current.meaning}</p><div className={styles.actions}>
              <button onClick={() => rate('again')}>Again · 10 min</button><button onClick={() => rate('hard')}>Hard</button>
              <button onClick={() => rate('good')}>Good</button><button onClick={() => rate('easy')}>Easy</button>
            </div></>}
        </> : <>
          <p>Choose the dictionary meaning.</p><div className={styles.actions}>{choices.map(meaning => <button key={meaning} disabled={choice !== null} onClick={() => { setChoice(meaning); setRevealed(true); }}>{meaning}</button>)}</div>
          {choice !== null && <><p role="status">{choice === current.meaning ? 'Correct.' : `Not quite. ${current.meaning}`}</p>
            <button className={styles.primary} onClick={() => rate(choice === current.meaning ? 'good' : 'again')}>Save result & continue</button></>}
        </>}
        {revealed && <><p className={styles.source}>{current.source}</p>{current.context && <details><summary>See it in context</summary><p className="coptic-text">{current.context}</p></details>}</>}
      </section> : cards.length > 0 && <section className={styles.panel}><h2>Nothing due right now</h2><p>Next review: {new Date(Math.min(...cards.map(card => card.dueAt))).toLocaleString()}.</p><Link className={styles.link} href="/read/">Read and save more words →</Link></section>}
      {!!cards.length && <details><summary>Saved words ({cards.length})</summary>{cards.map(card => <article className={styles.panel} key={card.id}>
        <h3 className="coptic-text">{card.word}</h3><p>{card.meaning}</p><p className={styles.muted}>Due {new Date(card.dueAt).toLocaleString()} · {card.reviews} reviews</p>
        <Link className={styles.link} href={`/dictionary/entry/?lemma=${encodeURIComponent(card.word)}`}>Dictionary entry</Link>
      </article>)}</details>}
      <p className={styles.muted}>Reviews and words are saved on this device. Reinstalling or clearing app data can remove them.</p>
    </>}
  </main>;
}
