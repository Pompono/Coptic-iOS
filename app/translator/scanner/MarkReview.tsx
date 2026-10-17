"use client";
import { useEffect, useState } from 'react';
import { inspectMarkPhoto } from '@/lib/scanner/markPhoto';
import AppIcon from '@/app/AppIcon';
import { reviewableMarks } from '@/lib/scanner/markShape.mjs';
import type { ScanRegion } from '@/lib/scanner/recognize';
import type { ScanImage } from '@/lib/scanner/images';
import styles from './scanner.module.css';

export default function MarkReview({ image, region, disabled, onCorrect }: {
  image: ScanImage; region: ScanRegion; disabled: boolean;
  onCorrect: (start: number, length: number, text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [inspection, setInspection] = useState<{ kind: string; reason: string; url: string } | null>(null);
  const [error, setError] = useState('');
  const words = region.markedWords ?? [];
  const word = words[index];
  useEffect(() => {
    if (!open || !word) return;
    let current = true; setInspection(null); setError('');
    void inspectMarkPhoto(image, word).then(result => { if (current) setInspection(result); })
      .catch(failure => { if (current) setError(String(failure.message)); });
    return () => { current = false; };
  }, [open, index, image.url, region.id]);
  if (!words.length) return null;
  const safe = reviewableMarks(region.text, region.originalText);
  const currentWord = word ? region.text.slice(word.start, word.start + word.text.length) : '';
  return <details className={styles.markReview} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="disclosure-summary">Inspect marks in the photo ({words.length} words)<span className="disclosure-chevron"><AppIcon name="chevron" size={16}/></span></summary>
    {open && word && <>
      <label>Marked word <select aria-label="Marked word to inspect" value={index} disabled={disabled} onChange={event => setIndex(Number(event.target.value))}>
        {words.map((item, position) => <option key={position} value={position}>{position + 1}. {item.text}</option>)}
      </select></label>
      {inspection ? <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.markPhoto} src={inspection.url} alt="Magnified original photographed word and its marks" />
        <p><strong>Image hint: {inspection.kind === 'jinkem-like' ? 'jinkem-like' : inspection.kind === 'overline-like' ? 'overline-like' : 'uncertain'}</strong></p>
        <p className={styles.note}>{inspection.reason}</p>
      </> : !error && <p role="status">Inspecting the original photo…</p>}
      {error && <p role="alert">{error}</p>}
      <p className={styles.note}>This uses the photographed ink and text baseline, not just the recognised Unicode character. Shape hints are experimental; short horizontal marks can mean either thing. Nothing changes automatically.</p>
      <div className={styles.actions}>
        <button disabled={disabled || !safe || !/[\u0304\u0305]/u.test(currentWord)} onClick={() => onCorrect(word.start, word.text.length, currentWord.replace(/[\u0304\u0305]/gu, '\u0300'))}>Use jinkem for this word</button>
        <button disabled={disabled || !safe || !/\u0300/u.test(currentWord)} onClick={() => onCorrect(word.start, word.text.length, currentWord.replace(/\u0300/gu, '\u0305'))}>Use overline for this word</button>
      </div>
      {!safe && <p className={styles.note}>The text no longer aligns with the original OCR positions. Inspect the photo here, then correct the text manually.</p>}
    </>}
  </details>;
}
