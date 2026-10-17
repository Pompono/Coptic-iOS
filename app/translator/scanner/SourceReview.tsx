"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { characterDiff } from '@/lib/scanner/sourceSuggestions.mjs';
import AppIcon from '@/app/AppIcon';
import { editImage, type ScanImage } from '@/lib/scanner/images';
import type { ScanRegion } from '@/lib/scanner/recognize';
import styles from './scanner.module.css';
type Suggestion = { text: string; sourceRow: string; distance: number; similarity: number };
export default function SourceReview({ image, region, disabled, onAccept }: {
  image: ScanImage; region: ScanRegion; disabled: boolean; onAccept: (text: string) => void;
}) {
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searchedText, setSearchedText] = useState('');
  const [selected, setSelected] = useState(0), [confirmed, setConfirmed] = useState(false);
  const [photo, setPhoto] = useState(''), [error, setError] = useState('');
  const worker = useRef<Worker | null>(null), sequence = useRef(0);
  useEffect(() => () => { worker.current?.terminate(); }, []);
  useEffect(() => {
    setConfirmed(false); setSuggestions([]); setSelected(0); setPhoto(''); setError('');
    if (!open) return;
    let live = true;
    const id = ++sequence.current; setLoading(true);
    try {
      worker.current ??= new Worker(new URL('../../../lib/scanner/sourceWorker.ts', import.meta.url));
      worker.current.onmessage = ({ data }) => {
        if (!live || data.id !== id) return;
        setLoading(false); setSearchedText(region.text); setSuggestions(data.suggestions || []); setError(data.error || '');
      };
      worker.current.onerror = () => { if (live) { setLoading(false); setError('Published passage search could not start.'); } worker.current?.terminate(); worker.current = null; };
      worker.current.postMessage({ id, text: region.text });
    } catch { setLoading(false); setError('Published passage search is unavailable.'); }
    const margin = Math.max(14, region.box.height * image.height * .2);
    const x = Math.max(0, region.box.x - margin / image.width), y = Math.max(0, region.box.y - margin / image.height);
    const cropBox = { x, y, width: Math.min(1, region.box.x + region.box.width + margin / image.width) - x,
      height: Math.min(1, region.box.y + region.box.height + margin / image.height) - y };
    void editImage(image, cropBox).then(crop => { if (live) setPhoto(crop.url); })
      .catch(() => { if (live) setError('The original block photo could not load.'); });
    return () => { live = false; };
  }, [open, region.id, region.text, image.url]);
  const candidate = searchedText === region.text ? suggestions[selected] : undefined;
  const diff = useMemo(() => candidate ? characterDiff(region.text, candidate.text) : [], [region.text, candidate]);
  return <details className={styles.markReview} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="disclosure-summary">Find a published passage to check these letters<span className="disclosure-chevron"><AppIcon name="chevron" size={16}/></span></summary>
    {open && <>
      <p className={styles.note}>Suggestions compare text shapes and spelling; they do not prove that the passage is correct. Nothing changes until you check the photo and accept it.</p>
      {loading && <p role="status">Searching published passages…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !candidate && <p>No close published passage found. Crop a smaller passage or correct the letters manually.</p>}
      {candidate && <>
        <label>Possible passage <select aria-label="Possible published passage" value={selected} disabled={disabled}
          onChange={event => { setSelected(Number(event.target.value)); setConfirmed(false); }}>
          {suggestions.map((item, index) => <option key={item.sourceRow} value={index}>{index + 1}. {item.text.slice(0, 45)}…</option>)}
        </select></label>
        {photo && <img className={styles.markPhoto} src={photo} alt="Original photographed block for checking suggested letters" />}
        <p className={styles.note}>Highlighted characters differ. The published spelling may also change spacing or omit printed marks.</p>
        <p className="coptic-text" aria-label="Recognised letters compared with source">{diff.map((item, index) => <span key={index} className={item.changed ? styles.changedBefore : undefined}>{item.before}</span>)}</p>
        <p className="coptic-text" aria-label="Suggested published letters">{diff.map((item, index) => <span key={index} className={item.changed ? styles.changedAfter : undefined}>{item.after}</span>)}</p>
        <p className={styles.note}>Source: Coptic Corpora / Tasbeha · {candidate.sourceRow}</p>
        <label className={styles.reviewConfirmation}><input type="checkbox" checked={confirmed} disabled={disabled || !photo}
          onChange={event => setConfirmed(event.target.checked)} /> I checked this passage against the photo</label>
        <button disabled={disabled || !confirmed || !photo || loading} onClick={() => { onAccept(candidate.text); setConfirmed(false); }}>
          Use this published Coptic text
        </button>
        <p className={styles.note}>This replaces this block’s text, including its spelling and marks. Restore recognised text returns the original scan. Translate separately after checking.</p>
      </>}
    </>}
  </details>;
}
