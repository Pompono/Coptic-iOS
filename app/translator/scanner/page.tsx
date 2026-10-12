"use client";

import Link from '@/lib/AppLink';
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { disposeLocalTranslator, hasLocalTranslator, translateLocally } from '@/lib/localTranslation/client';
import { recognizePhoto, type ScanRegion } from '@/lib/scanner/recognize';
import { editImage, prepareImage, type Box, type ScanImage } from '@/lib/scanner/images';
import { cropBox } from '@/lib/scanner/regions.mjs';
import { isBohairicOnlyEnabled } from '@/app/BohairicPreference';
import styles from './scanner.module.css';
import { scrollToSection } from '@/lib/scrollToSection';
import { hasOverline, overlinesToJinkem } from '@/lib/scanner/marks.mjs';
import MarkReview from './MarkReview';
import SourceReview from './SourceReview';
import ReferenceDetails from '../ReferenceDetails';

type Busy = 'photo' | 'recognition' | 'translation' | null;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export default function ScannerPage() {
  const [image, setImage] = useState<ScanImage | null>(null);
  const [regions, setRegions] = useState<ScanRegion[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [omitted, setOmitted] = useState(0);
  const [showEnglish, setShowEnglish] = useState(true);
  const [local, setLocal] = useState<boolean | null>(null);
  const [enhanceContrast, setEnhanceContrast] = useState(false);
  const [translationMethod, setTranslationMethod] = useState<'published' | 'experimental'>('published');
  const [dialect, setDialect] = useState<'bohairic' | 'sahidic'>('bohairic');
  const [bohairicOnly, setBohairicOnly] = useState(true);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState<Box | null>(null);
  const cropStart = useRef<{ x: number; y: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const operation = useRef(0);
  const busyRef = useRef<Busy>(null);
  const cancelRecognition = useRef<(() => void) | null>(null);
  const selected = regions.find(region => region.id === selectedId);

  useEffect(() => {
    let mounted = true;
    void hasLocalTranslator().then(value => { if (mounted) setLocal(value); });
    setBohairicOnly(isBohairicOnlyEnabled());
    return () => {
      mounted = false;
      operation.current++;
      cancelRecognition.current?.();
      disposeLocalTranslator();
    };
  }, []);

  function start(kind: Busy) {
    busyRef.current = kind;
    setBusy(kind);
    setError('');
    return ++operation.current;
  }
  function finish(id: number) {
    if (operation.current !== id) return;
    busyRef.current = null;
    setBusy(null);
  }
  function resetRegions() {
    setRegions([]); setSelectedId(''); setOmitted(0);
    setCrop(null); setCropping(false); setStatus('');
    disposeLocalTranslator();
  }
  function cancel() {
    operation.current++;
    cancelRecognition.current?.(); cancelRecognition.current = null;
    disposeLocalTranslator();
    busyRef.current = null; setBusy(null); setStatus('Stopped. You can try again.');
  }

  async function openPhoto(source: CameraSource) {
    if (busyRef.current) return;
    if (!Capacitor.isNativePlatform()) {
      (source === CameraSource.Camera ? cameraInput : fileInput).current?.click();
      return;
    }
    const id = start('photo');
    setStatus('Opening photo…');
    try {
      const photo = await Camera.getPhoto({
        source, resultType: CameraResultType.Uri, quality: 95,
        width: 3072, height: 3072, correctOrientation: true, saveToGallery: false,
      });
      if (!photo.webPath) throw new Error('The photo could not be opened.');
      const prepared = await prepareImage(photo.webPath);
      if (operation.current !== id) return;
      resetRegions(); setImage(prepared);
    } catch (failure) {
      if (operation.current !== id) return;
      const message = errorMessage(failure);
      if (/cancel/i.test(message)) setStatus('No photo selected.');
      else { setError(`Could not open the photo. ${message}`); setStatus(''); }
    } finally { finish(id); }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busyRef.current) return;
    if (file.size > 25 * 1024 * 1024) { setError('Choose a photo smaller than 25 MB.'); return; }
    const id = start('photo');
    const url = URL.createObjectURL(file);
    try {
      const prepared = await prepareImage(url);
      if (operation.current !== id) return;
      resetRegions(); setImage(prepared);
    } catch (failure) {
      if (operation.current === id) setError(errorMessage(failure));
    } finally { URL.revokeObjectURL(url); finish(id); }
  }

  async function transform(cropArea?: Box) {
    if (!image || busyRef.current) return;
    const id = start('photo');
    try {
      const prepared = await editImage(image, cropArea);
      if (operation.current !== id) return;
      resetRegions(); setImage(prepared);
    } catch (failure) {
      if (operation.current === id) setError(errorMessage(failure));
    } finally { finish(id); }
  }

  async function recognize() {
    if (!image || busyRef.current) return;
    resetRegions();
    const id = start('recognition');
    const task = recognizePhoto(image, message => {
      if (operation.current === id) setStatus(message);
    }, enhanceContrast);
    cancelRecognition.current = task.cancel;
    try {
      const result = await task.result;
      if (operation.current !== id) return;
      setRegions(result.regions); setOmitted(result.omitted);
      setSelectedId(result.regions[0]?.id ?? '');
      setStatus(result.regions.length ? 'Text recognised. Check it before translating.' : 'No Coptic text found. Try a closer, brighter photo or crop the text area.');
    } catch (failure) {
      if (operation.current === id) { setError(errorMessage(failure)); setStatus(''); }
    } finally {
      if (operation.current === id) cancelRecognition.current = null;
      finish(id);
    }
  }

  async function translate(all: boolean) {
    if (busyRef.current || !local) return;
    const targets = all ? regions.filter(region => region.text.trim() && !region.translation)
      : selected?.text.trim() ? [selected] : [];
    if (!targets.length) return;
    const id = start('translation');
    try {
      for (const [index, region] of targets.entries()) {
        if (operation.current !== id) break;
        setStatus(`Translating block ${index + 1} of ${targets.length}…`);
        const result = await translateLocally(region.text, dialect, translationMethod, message => { if (operation.current === id) setStatus(`Block ${index + 1} of ${targets.length} · ${message}`); });
        if (operation.current !== id) break;
        setRegions(previous => previous.map(item => item.id === region.id
          ? { ...item, translation: result.translation, translationMethod: result.method, referenceText: result.matchedText, referenceRow: result.sourceRow, error: undefined } : item));
      }
      if (operation.current === id) { setShowEnglish(true); setStatus('Translation ready. Tap a bubble to review the full text.'); }
    } catch (failure) {
      if (operation.current === id) { setError(errorMessage(failure)); setStatus('Completed translations are kept. You can retry the remaining blocks.'); }
    } finally {
      if (operation.current === id) disposeLocalTranslator();
      finish(id);
    }
  }

  function point(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left - event.currentTarget.clientLeft) / event.currentTarget.clientWidth,
      y: (event.clientY - bounds.top - event.currentTarget.clientTop) / event.currentTarget.clientHeight,
    };
  }
  function selectRegion(id: string, scroll = false) {
    setSelectedId(id);
    if (scroll) scrollToSection(editor.current);
  }
  function insertCharacter(character: string) {
    if (!selected || busyRef.current) return;
    const input = textInput.current;
    const start = input?.selectionStart ?? selected.text.length;
    const end = input?.selectionEnd ?? start;
    const text = selected.text.slice(0, start) + character + selected.text.slice(end);
    if (text.length > 1200) { setError('Keep this block under 1,200 characters.'); return; }
    input?.setRangeText(character, start, end, 'end');
    input?.focus({ preventScroll: true });
    setRegions(previous => previous.map(region => region.id === selected.id ? { ...region, text, translation: undefined } : region));
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href="/translator/" className={styles.back}>← Translator</Link>
        <div className={styles.heading}><h1>Scan Coptic</h1><span className={styles.badge}>Experimental</span></div>
        <p className={styles.muted}>Photograph printed Coptic, check the recognised text, then translate it over the image.</p>
        <p className={styles.note}>Photos and recognised text stay on this device. Clear, upright text works best. Handwriting and old manuscripts may not read correctly.</p>

        <div className={styles.actions}>
          <button className={styles.primary} disabled={!!busy} onClick={() => void openPhoto(CameraSource.Camera)}>Take photo</button>
          <button disabled={!!busy} onClick={() => void openPhoto(CameraSource.Photos)}>Choose photo</button>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" aria-label="Take a Coptic photo" className={styles.file} onChange={event => void importFile(event)} />
          <input ref={fileInput} type="file" accept="image/*" aria-label="Choose a Coptic photo" className={styles.file} onChange={event => void importFile(event)} />
        </div>

        {image && <>
          <div className={styles.toolbar}>
            <div className={styles.actions}>
              <button disabled={!!busy} onClick={() => void transform()}>Rotate ↻</button>
              <button disabled={!!busy} aria-pressed={cropping} onClick={() => { setCropping(!cropping); setCrop(null); }}>Crop photo</button>
              {cropping && <button disabled={!crop || crop.width < 0.03 || crop.height < 0.03} onClick={() => void transform(crop!)}>Apply crop</button>}
              <button className={styles.primary} disabled={!!busy || cropping} onClick={() => void recognize()}>Read Coptic</button>
            </div>
            {!!regions.length && <button disabled={!!busy} aria-pressed={showEnglish} onClick={() => setShowEnglish(!showEnglish)}>{showEnglish ? 'Show original' : 'Show English'}</button>}
          </div>
          <label className={styles.reviewConfirmation}><input type="checkbox" checked={enhanceContrast} disabled={!!busy}
            onChange={event => setEnhanceContrast(event.target.checked)} /> Improve contrast before reading</label>
          <p className={styles.note}>Optional grayscale contrast adjustment for faint or bright-on-dark text. The original color photo stays available for checking letters.</p>
          {selected && !cropping && <button disabled={!!busy} onClick={() => scrollToSection(editor.current)}>Edit selected text block ↓</button>}
          {cropping && <p className={styles.note}>Drag a rectangle around the text, then apply the crop. Cropping removes previous recognition results.</p>}
          <div className={`${styles.photo} ${cropping ? styles.cropping : ''}`}
            onPointerDown={event => {
              if (!cropping || busyRef.current) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              cropStart.current = point(event); setCrop(null);
            }}
            onPointerMove={event => { if (cropping && cropStart.current) setCrop(cropBox(cropStart.current, point(event))); }}
            onPointerUp={event => { if (cropStart.current) setCrop(cropBox(cropStart.current, point(event))); cropStart.current = null; }}
            onPointerCancel={() => { cropStart.current = null; setCrop(null); }}>
            {/* The image defines the container aspect ratio, so normalized OCR boxes stay aligned on resize. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} width={image.width} height={image.height} alt="Selected Coptic page" draggable={false} />
            {!cropping && regions.map((region, index) => <button key={region.id}
              className={`${styles.region} ${region.id === selectedId ? styles.selected : ''} ${showEnglish && region.translation ? styles.translated : ''}`}
              aria-label={`Review text block ${index + 1}`} aria-pressed={region.id === selectedId}
              disabled={!!busy} onClick={() => selectRegion(region.id)}
              style={{ left: `${region.box.x * 100}%`, top: `${region.box.y * 100}%`, width: `${region.box.width * 100}%`, height: `${region.box.height * 100}%` }}>
              {showEnglish && region.translation
                ? <span className={styles.bubble} style={region.box.x > .5 ? { left: 'auto', right: 0 } : undefined}>{region.translation}</span>
                : <span className={styles.marker}>{index + 1}</span>}
            </button>)}
            {cropping && crop && <div className={styles.cropBox} style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }} />}
          </div>
        </>}

        <div aria-live="polite" className={styles.status}>{status}</div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {(busy === 'recognition' || busy === 'translation') && <button onClick={cancel}>Stop</button>}
        {omitted > 0 && <p className={styles.note}>Showing the first {regions.length} blocks. Crop another part of the page to read the remaining text.</p>}

        {!!regions.length && <div ref={editor} className={styles.editor}>
          <div className={styles.toolbar}>
            <h2>Review recognised text</h2>
            <label className={styles.dialect}>Translation method
              <select aria-label="Translation method" value={translationMethod} disabled={!!busy} onChange={event => {
                setTranslationMethod(event.target.value as typeof translationMethod); setError('');
                setRegions(previous => previous.map(region => ({ ...region, translation: undefined })));
              }}><option value="published">Published text</option><option value="experimental">Experimental AI draft</option></select>
            </label>
            <label className={styles.dialect}>Dialect
              <select aria-label="Scanner dialect" disabled={!!busy || bohairicOnly} value={dialect}
                onChange={event => { setDialect(event.target.value as typeof dialect); setRegions(previous => previous.map(region => ({ ...region, translation: undefined }))); }}>
                <option value="bohairic">Bohairic</option><option value="sahidic">Sahidic</option>
              </select>
            </label>
          </div>
          {bohairicOnly && <p className={styles.note}>Bohairic-only is enabled in Settings.</p>}
          <div className={styles.blockPicker} aria-label="Recognised text blocks">
            {regions.map((region, index) => <button key={region.id} disabled={!!busy} aria-pressed={region.id === selectedId}
              onClick={() => selectRegion(region.id, false)}>Block {index + 1}{region.translation ? ' ✓' : ''}</button>)}
          </div>
          {selected && <>
            <label htmlFor="recognised-text">Coptic text · block {regions.indexOf(selected) + 1}</label>
            {selected.confidence < 80 && <p className={styles.note}>Some characters were difficult to read. Check this block carefully.</p>}
            <textarea ref={textInput} id="recognised-text" aria-label="Recognised Coptic text" className="coptic-text" value={selected.text}
              maxLength={1200} disabled={!!busy} spellCheck={false} rows={4}
              onChange={event => { const text = event.target.value; setRegions(previous => previous.map(region => region.id === selected.id ? { ...region, text, translation: undefined } : region)); }} />
            <div className={styles.actions}>
              <button disabled={!!busy} onPointerDown={event => event.preventDefault()} onClick={() => insertCharacter('Ⲭ')}>Insert <span className="coptic-text">Ⲭ</span></button>
              <button disabled={!!busy} onPointerDown={event => event.preventDefault()} onClick={() => insertCharacter('ⲭ')}>Insert <span className="coptic-text">ⲭ</span></button>
              <button disabled={!!busy} onPointerDown={event => event.preventDefault()} onClick={() => insertCharacter('\u0300')}>Insert jinkem</button>
            </div>
            <p className={styles.note}>Place the cursor where a letter is missing, or select the wrong letter, then insert its replacement. Chi can be confused with Ϫ; check the photo before changing it.</p>
            <div className={styles.actions}>
              <button disabled={!!busy || !hasOverline(selected.text)} onClick={() => setRegions(previous => previous.map(region => region.id === selected.id
                ? { ...region, text: overlinesToJinkem(region.text), translation: undefined } : region))}>Change overlines to jinkem</button>
              <button disabled={!!busy || selected.text === selected.originalText} onClick={() => setRegions(previous => previous.map(region => region.id === selected.id
                ? { ...region, text: region.originalText, translation: undefined } : region))}>Restore recognised text</button>
            </div>
            <p className={styles.note}>Use the jinkem correction only when that is the mark in the photo. Abbreviations may have real overlines. Restore recognised text also undoes manual edits in this block.</p>
            {image && <MarkReview key={selected.id} image={image} region={selected} disabled={!!busy}
              onCorrect={(start, length, replacement) => setRegions(previous => previous.map(region => region.id === selected.id
                ? { ...region, text: region.text.slice(0, start) + replacement + region.text.slice(start + length), translation: undefined } : region))} />}
            {image && dialect === 'bohairic' && <SourceReview key={selected.id} image={image} region={selected} disabled={!!busy}
              onAccept={text => {
                setError(''); setStatus('Published text applied. Check it, then translate this block.');
                setRegions(previous => previous.map(region => region.id === selected.id
                  ? { ...region, text, translation: undefined, translationMethod: undefined, referenceText: undefined, referenceRow: undefined } : region));
              }} />}
            <div className={styles.actions}>
              <button className={styles.primary} disabled={!!busy || !local || !selected.text.trim()} onClick={() => void translate(false)}>Translate block</button>
              <button disabled={!!busy || !local || !regions.some(region => region.text.trim() && !region.translation)} onClick={() => void translate(true)}>Translate remaining blocks</button>
            </div>
            {selected.translation && <div className={styles.output}><h3>{selected.translationMethod === "published" ? "Published translation · Coptic Corpora / Tasbeha" : "Unverified AI draft"}</h3><p>{selected.translation}</p>{selected.translationMethod === "published" && <ReferenceDetails text={selected.referenceText} row={selected.referenceRow} />}</div>}
          </>}
          {local === false && <p className={styles.note}>Photo recognition is available. Translation needs the offline-model IPA build.</p>}
          {local === true && <p className={styles.note}>Coptic → English runs offline. Published text requires a match to a supported passage. Check the recognised letters; unmatched text is left unresolved. AI drafts can contain wrong meanings.</p>}
        </div>}
        {image && <button disabled={!!busy} className={styles.clear} onClick={() => { resetRegions(); setImage(null); setError(''); }}>Clear photo</button>}
      </div>
    </main>
  );
}
