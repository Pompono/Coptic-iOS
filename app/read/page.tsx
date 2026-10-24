"use client";
import { readRecord, writeRecord } from "@/lib/progressStorage";
import AudioReplay from "../AudioReplay";
import PageHeader, { PageBackLink } from "../PageHeader";
import AppIcon from "../AppIcon";
import DelayedStatus from '../DelayedStatus';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/lib/AppLink';
import SaveWord from '@/app/SaveWord';
import { loadReadingDictionary } from '@/lib/reading/dictionary';
import { makeWordIndex, lookupWord, passageTokens } from '@/lib/reading/text.mjs';
import { practicePassages, grammarNotes } from '@/lib/reading/passages.mjs';
import { isBohairicOnlyEnabled } from '@/app/BohairicPreference';
import type { DictionaryEntry } from '@/lib/dictionary';
import { resolveLessonAudio } from '@/lib/lessonAudio';
import styles from '../reading.module.css';
import { scrollToSection } from '@/lib/scrollToSection';

export default function ReaderPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passageId, setPassageId] = useState(practicePassages[0].id);
  const [text, setText] = useState(practicePassages[0].text);
  const [draft, setDraft] = useState('');
  const [selected, setSelected] = useState<{ text: string; id: number } | null>(null);
  const [showMeaning, setShowMeaning] = useState(false);
  const [bohairicOnly, setBohairicOnly] = useState(true);
  const detail = useRef<HTMLDivElement>(null);
  const passagePanel = useRef<HTMLElement>(null);
  useEffect(() => {
    let mounted = true;
    setBohairicOnly(isBohairicOnlyEnabled());
    try {
      const raw = readRecord('coptic-reader:v1');
      if (raw) {
        const saved = raw;
        if (saved.version === 1 && typeof saved.draft === 'string' && saved.draft.length <= 6000) {
          setDraft(saved.draft);
          const known = practicePassages.find(item => item.id === saved.passageId);
          if (known) { setPassageId(known.id); setText(known.text); }
          else if (saved.passageId === 'custom' && saved.draft.trim()) { setPassageId('custom'); setText(saved.draft.trim()); }
        }
      }
    } catch { setError('Your previous passage could not be restored. The stored copy has not been changed.'); }
    void loadReadingDictionary().then(data => { if (mounted) setEntries(data); })
      .catch(failure => { if (mounted) setError(String(failure.message)); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  const index = useMemo(() => makeWordIndex(entries), [entries]);
  const result = selected ? lookupWord(index, selected.text, bohairicOnly) : null;
  const passage = practicePassages.find(item => item.id === passageId);
  const recording = selected ? resolveLessonAudio('', selected.text.toLowerCase()) : null;
  const tokens = useMemo(() => passageTokens(text), [text]);
  function rememberPassage(id: string, customText = draft) {
    try { writeRecord('coptic-reader:v1', { version: 1, passageId: id, draft: customText }); }
    catch { setError('This passage could not be saved for later. You can still read it now.'); }
  }
  function wordEntry(entry: DictionaryEntry) {
    const recordedLemma = resolveLessonAudio('', entry.lemma)?.src;
    const source = entry.entryUrl?.startsWith('crum:') ? `Crum ${entry.entryUrl.slice(5)}` : entry.source;
    return <div className={styles.panel} key={entry.id}>
      <h3 className="coptic-text">{entry.lemma}</h3>
      <p>{entry.gloss.join('; ')}</p>
      <p className={styles.muted}>{entry.dialect === 'bohairic' ? 'Bohairic' : 'Dialect not specified'}{entry.pos ? ` · ${entry.pos}` : ''}</p>
      <p className={styles.muted}>Dictionary lemma: <span className="coptic-text">{entry.lemma}</span></p>
      {!!entry.forms.filter(form => form !== entry.lemma).length && <p className={styles.muted}>Listed forms: <span className="coptic-text">{entry.forms.filter(form => form !== entry.lemma).join(', ')}</span></p>}
      <p className={styles.source}>{source}</p>
      {entry.pos !== 'Cross-reference' && entry.gloss.length > 0 && <SaveWord word={entry.lemma} meaning={entry.gloss.join('; ')} pos={entry.pos} dialect={entry.dialect} context={text} source={source} audio={recordedLemma} />}
      <div className={styles.actions}><Link className={styles.link} href={`/dictionary/entry/?lemma=${encodeURIComponent(entry.lemma)}`}>Full dictionary entry</Link></div>
    </div>;
  }
  return <main className={styles.shell}>
    <PageBackLink href="/">Home</PageBackLink>
    <PageHeader title="Read Coptic" icon="reader"><Link className="ui-secondary" href="/vocabulary/">Vocabulary & review</Link></PageHeader>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.segmented} role="group" aria-label="Reading passage">{practicePassages.map(item => <button key={item.id} aria-pressed={passageId === item.id} onClick={() => {
      setPassageId(item.id); setText(item.text); setSelected(null); setShowMeaning(false); rememberPassage(item.id);
    }}>{item.title}</button>)}</div>
    <details><summary className="disclosure-summary">Read your own passage<span className="disclosure-chevron"><AppIcon name="chevron" size={16}/></span></summary>
      <label htmlFor="reading-input">Paste Coptic text (up to 6,000 characters)</label>
      <textarea id="reading-input" className="coptic-text" maxLength={6000} value={draft} onChange={event => setDraft(event.target.value)} />
      <button disabled={!draft.trim()} onClick={() => { setText(draft.trim()); setPassageId('custom'); setSelected(null); setShowMeaning(false); rememberPassage('custom'); }}>Open passage</button>
      <p className={styles.muted}>Open passage saves it on this device so you can return later. Dictionary lookup works offline.</p>
    </details>
    <section ref={passagePanel} className={styles.panel} aria-label="Coptic passage">
      <h2>{passage?.title ?? 'Your passage'}</h2>
      {passage && <p className={styles.muted}>{passage.dialect} · {passage.description}</p>}
      <div className={`${styles.passage} coptic-text`}>{tokens.map(token => token.word ?
        <button key={token.id} disabled={loading} aria-pressed={selected?.id === token.id}
          aria-label={`Look up ${token.text}`} onClick={() => setSelected(token)}>{token.text}</button>
        : <span key={token.id}>{token.text}</span>)}</div>
      {selected && result && <div className={styles.selectionPreview} aria-live="polite">
        <span className="coptic-text">{selected.text}</span>
        <p>{result.matches[0]?.gloss[0] ?? result.analyses[0]?.entries[0]?.gloss[0] ?? 'No supported dictionary match.'}</p>
        <button onClick={() => scrollToSection(detail.current)}>View word details ↓</button>
      </div>}
      {passage && <><button aria-expanded={showMeaning} onClick={() => setShowMeaning(!showMeaning)}>{showMeaning ? 'Hide phrase meanings' : 'Show phrase meanings'}</button>
        {showMeaning && <p>{passage.translation}</p>}<p className={styles.source}>{passage.source}</p></>}
      {loading && <DelayedStatus>Loading the bundled dictionary…</DelayedStatus>}
    </section>
    <div ref={detail}>
      {selected && result && <section aria-label="Word explanation">
        <button onClick={() => scrollToSection(passagePanel.current)}>↑ Back to passage</button>
        <h2 className="coptic-text">{selected.text}</h2>
        {recording?.src ? <AudioReplay path={recording.src}/>
          : <p className={styles.muted}>No recording for this exact word yet.</p>}
        {result.ignoresMarks && <p className={styles.muted}>Spelling matches below ignore combining marks. The original text is preserved above.</p>}
        {result.matches.map(wordEntry)}
        {result.analyses.map(analysis => <section className={styles.panel} key={analysis.prefix.text}>
          <h3>Possible article + noun</h3>
          <p><span className="coptic-text">{analysis.prefix.text}-</span> ({analysis.prefix.meaning}) + <span className="coptic-text">{analysis.stem}</span></p>
          <p className={styles.muted}>A dictionary-supported possibility, not a complete sentence analysis. Context can change which meaning applies.</p>
          <p className={styles.source}>Article forms: bundled Bohairic dictionary, ⲡ- and its variants.</p>
          {analysis.entries.map(wordEntry)}
        </section>)}
        {!result.matches.length && !result.analyses.length && <p>No supported dictionary match found. This may be an inflected form, a name, or a spelling the dictionary does not cover.</p>}
      </section>}
    </div>
    <section className={styles.panel}><h2>Understand the grammar</h2>
      {grammarNotes.map(note => <details key={note.id}><summary className="disclosure-summary">{note.title}<span className="disclosure-chevron"><AppIcon name="chevron" size={16}/></span></summary><p>{note.text}</p><p className={styles.source}>{note.source}</p></details>)}
    </section>
  </main>;
}
