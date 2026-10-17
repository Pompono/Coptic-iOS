"use client";
import PageHeader, { PageBackLink } from "../../PageHeader";

import AppIcon from "@/app/AppIcon";
import Link from '@/lib/AppLink';
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { publishedTranslation } from '@/lib/localTranslation/referenceClient';
import { translationRequest } from '@/lib/translationService';
import { createScannerTranslator, planScannerTranslation } from '@/lib/scanner/hostedTranslation.mjs';
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
  const [approval, setApproval] = useState<ReturnType<typeof planScannerTranslation> | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const translationController = useRef<AbortController | null>(null);
  const scannerTranslator = useRef<ReturnType<typeof createScannerTranslator> | null>(null);
  if (!scannerTranslator.current) scannerTranslator.current = createScannerTranslator({ request: translationRequest });
  const locked = !!busy || !!approval;
  const approvalPanel = useRef<HTMLElement | null>(null);
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
    setBohairicOnly(isBohairicOnlyEnabled());
    const lifecycle = operation;
    const recognition = cancelRecognition;
    const translation = translationController;
    const queue = scannerTranslator.current;
    return () => {
      lifecycle.current++;
      recognition.current?.();
      translation.current?.abort();
      queue.clear();
    };
  }, []);
  useEffect(() => {
    if (approval) { approvalPanel.current?.focus(); scrollToSection(approvalPanel.current); }
  }, [approval]);

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
    translationController.current?.abort();
    scannerTranslator.current.clear();
    setApproval(null); setReviewed(false);
  }
  function cancel() {
    operation.current++;
    cancelRecognition.current?.(); cancelRecognition.current = null;
    translationController.current?.abort();
    busyRef.current = null; setBusy(null); setStatus('Stopped. Completed translations are kept. Text already sent cannot be recalled; review and send the remaining text to resume.');
  }

  async function openPhoto(source: CameraSource) {
    if (busyRef.current || approval) return;
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
    if (!file || busyRef.current || approval) return;
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
    if (!image || busyRef.current || approval) return;
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
    if (!image || busyRef.current || approval) return;
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

  async function sendApprovedText(plan: ReturnType<typeof planScannerTranslation>) {
    if (busyRef.current || !reviewed || plan !== approval) return;
    setApproval(null); setReviewed(false);
    const id = start('translation');
    const controller = new AbortController();
    translationController.current = controller;
    try {
      await scannerTranslator.current.run(plan, {
        approved: true, signal: controller.signal,
        onProgress: message => { if (operation.current === id) setStatus(message); },
        onBlock: result => {
          if (operation.current !== id || controller.signal.aborted) return;
          setShowEnglish(true);
          setRegions(previous => previous.map(item => item.id === result.id && item.text === result.text
            ? { ...item, translation: result.translation, translationMethod: 'experimental',
                translationComplete: result.complete, completedParts: result.completedParts, totalParts: result.totalParts,
                referenceText: undefined, referenceRow: undefined, error: undefined } : item));
        },
      });
      if (operation.current === id) setStatus('Translation ready. AI drafts may be inaccurate; review every block.');
    } catch (failure) {
      if (operation.current === id) { setError(errorMessage(failure)); setStatus('Completed blocks and parts are kept. Review and send the remaining text to resume.'); }
    } finally {
      if (translationController.current === controller) translationController.current = null;
      finish(id);
    }
  }

  async function translate(all: boolean) {
    if (busyRef.current || approval) return;
    const targets = all ? regions.filter(region => region.text.trim() && (!region.translation || region.translationComplete === false))
      : selected?.text.trim() ? [selected] : [];
    if (!targets.length) return;
    if (translationMethod === 'experimental') {
      try {
        setError(''); setReviewed(false);
        setApproval(planScannerTranslation(targets, dialect));
      } catch (failure) { setError(errorMessage(failure)); }
      return; // Opening review never sends a request.
    }
    const id = start('translation');
    try {
      for (const [index, region] of targets.entries()) {
        if (operation.current !== id) break;
        setStatus(`Looking up published block ${index + 1} of ${targets.length} on this device…`);
        const result = await publishedTranslation(region.text, dialect);
        if (operation.current !== id) break;
        if (!result) throw new Error(dialect === 'bohairic'
          ? 'No unambiguous published translation matches this block. Correct the text or explicitly choose hosted AI.'
          : 'Published-text lookup covers Bohairic only. No AI request was made.');
        setRegions(previous => previous.map(item => item.id === region.id && item.text === region.text
          ? { ...item, translation: result.translation, translationMethod: result.method, translationComplete: true,
              referenceText: result.matchedText, referenceRow: result.sourceRow, error: undefined } : item));
      }
      if (operation.current === id) { setShowEnglish(true); setStatus('Published translation ready.'); }
    } catch (failure) {
      if (operation.current === id) { setError(errorMessage(failure)); setStatus('Completed translations are kept. You can retry the remaining blocks.'); }
    } finally { finish(id); }
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
    input?.setRangeText(character, start, end, 'end');
    input?.focus({ preventScroll: true });
    setRegions(previous => previous.map(region => region.id === selected.id ? { ...region, text, translation: undefined } : region));
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <PageBackLink href="/translator/">Translator</PageBackLink>
        <PageHeader title="Scan Coptic" icon="scan"/>
        <section className={styles.importPanel} aria-label="Import a photo">
        {!image&&<div className={styles.importEmpty}><AppIcon name="scan" size={42}/><h2>Start with a photo</h2><p>Choose a clear page of printed Coptic.</p></div>}
        <div className={styles.actions}>
          <button className={styles.primary} disabled={locked} onClick={() => void openPhoto(CameraSource.Camera)}>Take photo</button>
          <button disabled={locked} onClick={() => void openPhoto(CameraSource.Photos)}>Choose photo</button>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" aria-label="Take a Coptic photo" className={styles.file} onChange={event => void importFile(event)} />
          <input ref={fileInput} type="file" accept="image/*" aria-label="Choose a Coptic photo" className={styles.file} onChange={event => void importFile(event)} />
        </div>

        </section>
        <p className={styles.note}>Photos and OCR stay on this device. Published-text lookup is offline. Hosted AI sends only the Coptic text you review and approve over HTTPS to coptlingo.com; it never uploads photographs.</p>
        <details className={styles.tips}><summary className="disclosure-summary">About photo recognition<span className="disclosure-chevron"><AppIcon name="chevron" size={16}/></span></summary><p><span className="ui-status">Experimental recognition</span></p><p>Clear, upright text works best. Handwriting and old manuscripts may not read correctly.</p></details>

        {image && <>
          <div className={styles.toolbar}>
            <div className={styles.actions}>
              <button disabled={locked} onClick={() => void transform()}>Rotate ↻</button>
              <button disabled={locked} aria-pressed={cropping} onClick={() => { setCropping(!cropping); setCrop(null); }}>Crop photo</button>
              {cropping && <button disabled={locked || !crop || crop.width < 0.03 || crop.height < 0.03} onClick={() => void transform(crop!)}>Apply crop</button>}
              <button className={styles.primary} disabled={locked || cropping} onClick={() => void recognize()}>Read Coptic</button>
            </div>
            {!!regions.length && <button disabled={locked} aria-pressed={showEnglish} onClick={() => setShowEnglish(!showEnglish)}>{showEnglish ? 'Show original' : 'Show English'}</button>}
          </div>
          <label className={styles.reviewConfirmation}><input type="checkbox" checked={enhanceContrast} disabled={locked}
            onChange={event => setEnhanceContrast(event.target.checked)} /> Improve contrast before reading</label>
          <p className={styles.note}>Optional grayscale contrast adjustment for faint or bright-on-dark text. The original color photo stays available for checking letters.</p>
          {selected && !cropping && <button disabled={locked} onClick={() => scrollToSection(editor.current)}>Edit selected text block ↓</button>}
          {cropping && <p className={styles.note}>Drag a rectangle around the text, then apply the crop. Cropping removes previous recognition results.</p>}
          <div className={`${styles.photo} ${cropping ? styles.cropping : ''}`}
            onPointerDown={event => {
              if (!cropping || busyRef.current || approval) return;
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
              disabled={locked} onClick={() => selectRegion(region.id)}
              style={{ left: `${region.box.x * 100}%`, top: `${region.box.y * 100}%`, width: `${region.box.width * 100}%`, height: `${region.box.height * 100}%` }}>
              {showEnglish && region.translation
                ? <span className={styles.bubble} style={region.box.x > .5 ? { left: 'auto', right: 0 } : undefined}>{region.translationComplete === false ? 'Partial AI draft: ' : ''}{region.translation}</span>
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
              <select aria-label="Translation method" value={translationMethod} disabled={locked} onChange={event => {
                setTranslationMethod(event.target.value as typeof translationMethod); setError('');
                setRegions(previous => previous.map(region => ({ ...region, translation: undefined })));
              }}><option value="published">Published text</option><option value="experimental">Hosted AI draft · online</option></select>
            </label>
            <label className={styles.dialect}>Dialect
              <select aria-label="Scanner dialect" disabled={locked || bohairicOnly} value={dialect}
                onChange={event => { setDialect(event.target.value as typeof dialect); setRegions(previous => previous.map(region => ({ ...region, translation: undefined }))); }}>
                <option value="bohairic">Bohairic</option><option value="sahidic">Sahidic</option>
              </select>
            </label>
          </div>
          {bohairicOnly && <p className={styles.note}>Bohairic-only is enabled in Settings.</p>}
          <div className={styles.blockPicker} aria-label="Recognised text blocks">
            {regions.map((region, index) => <button key={region.id} disabled={locked} aria-pressed={region.id === selectedId}
              onClick={() => selectRegion(region.id, false)}>Block {index + 1}{region.translation ? region.translationComplete === false ? ' · partial' : ' ✓' : ''}</button>)}
          </div>
          {selected && <>
            <label htmlFor="recognised-text">Coptic text · block {regions.indexOf(selected) + 1}</label>
            {selected.confidence < 80 && <p className={styles.note}>Some characters were difficult to read. Check this block carefully.</p>}
            <textarea ref={textInput} id="recognised-text" aria-label="Recognised Coptic text" className="coptic-text" value={selected.text}
              disabled={locked} spellCheck={false} rows={4}
              onChange={event => { const text = event.target.value; setRegions(previous => previous.map(region => region.id === selected.id ? { ...region, text, translation: undefined } : region)); }} />
            <div className={styles.actions}>
              <button disabled={locked} onPointerDown={event => event.preventDefault()} onClick={() => insertCharacter('Ⲭ')}>Insert <span className="coptic-text">Ⲭ</span></button>
              <button disabled={locked} onPointerDown={event => event.preventDefault()} onClick={() => insertCharacter('ⲭ')}>Insert <span className="coptic-text">ⲭ</span></button>
              <button disabled={locked} onPointerDown={event => event.preventDefault()} onClick={() => insertCharacter('\u0300')}>Insert jinkem</button>
            </div>
            <p className={styles.note}>Place the cursor where a letter is missing, or select the wrong letter, then insert its replacement. Chi can be confused with Ϫ; check the photo before changing it.</p>
            <div className={styles.actions}>
              <button disabled={locked || !hasOverline(selected.text)} onClick={() => setRegions(previous => previous.map(region => region.id === selected.id
                ? { ...region, text: overlinesToJinkem(region.text), translation: undefined } : region))}>Change overlines to jinkem</button>
              <button disabled={locked || selected.text === selected.originalText} onClick={() => setRegions(previous => previous.map(region => region.id === selected.id
                ? { ...region, text: region.originalText, translation: undefined } : region))}>Restore recognised text</button>
            </div>
            <p className={styles.note}>Use the jinkem correction only when that is the mark in the photo. Abbreviations may have real overlines. Restore recognised text also undoes manual edits in this block.</p>
            {image && <MarkReview key={selected.id} image={image} region={selected} disabled={locked}
              onCorrect={(start, length, replacement) => setRegions(previous => previous.map(region => region.id === selected.id
                ? { ...region, text: region.text.slice(0, start) + replacement + region.text.slice(start + length), translation: undefined } : region))} />}
            {image && dialect === 'bohairic' && <SourceReview key={selected.id} image={image} region={selected} disabled={locked}
              onAccept={text => {
                setError(''); setStatus('Published text applied. Check it, then translate this block.');
                setRegions(previous => previous.map(region => region.id === selected.id
                  ? { ...region, text, translation: undefined, translationMethod: undefined, referenceText: undefined, referenceRow: undefined } : region));
              }} />}
            <div className={styles.actions}>
              <button className={styles.primary} disabled={locked || !selected.text.trim()} onClick={() => void translate(false)}>Translate block</button>
              <button disabled={locked || !regions.some(region => region.text.trim() && (!region.translation || region.translationComplete === false))} onClick={() => void translate(true)}>Translate remaining blocks</button>
            </div>
            {selected.translation && <div className={styles.output}><h3>{selected.translationMethod === "published" ? "Published translation · Coptic Corpora / Tasbeha" : selected.translationComplete === false ? `Partial AI draft · ${selected.completedParts} of ${selected.totalParts} parts` : "Unverified hosted AI draft"}</h3><p>{selected.translation}</p>{selected.translationMethod === "published" && <ReferenceDetails text={selected.referenceText} row={selected.referenceRow} />}</div>}
          </>}
          <p className={styles.note}>Published text requires an exact supported Bohairic match and works offline. Hosted AI needs internet and your approval; long blocks are split at word or sentence boundaries into requests of at most 1,200 characters. Split drafts may lose context and can contain wrong meanings. Completed parts are kept if you stop or a request fails.</p>

        </div>}
        {approval && <section ref={approvalPanel} tabIndex={-1} role="dialog" aria-labelledby="scanner-approval-title" className={styles.approval}>
          <h2 id="scanner-approval-title">Review text before sending</h2>
          <p>Only the Coptic text listed below will be sent over HTTPS to coptlingo.com for AI translation. Photographs, image crops, and OCR metadata stay on this device. AI requires internet and may be inaccurate.</p>
          <p>Dialect: {approval.dialect}. {approval.blocks.length} block(s), up to {approval.blocks.reduce((sum, block) => sum + block.parts.length, 0)} request(s). Requests run one at a time with pauses. Completed parts are reused locally. Stop prevents further requests; text already sent cannot be recalled.</p>
          {approval.blocks.map((block, index) => <details key={block.id} open><summary>Block {index + 1} · {block.parts.length} part(s)</summary><pre className="coptic-text">{block.text}</pre></details>)}
          <label className={styles.reviewConfirmation}><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /> I have reviewed all the listed text and approve sending it for AI translation.</label>
          <div className={styles.actions}>
            <button className={styles.primary} disabled={!reviewed} onClick={() => void sendApprovedText(approval)}>Send approved text</button>
            <button onClick={() => { setApproval(null); setReviewed(false); }}>Cancel sending</button>
          </div>
          <p>To correct text first, cancel and edit the block. Translation drafts are kept only in this screen’s memory, not saved to an account.</p>
        </section>}
        {image && <button disabled={locked} className={styles.clear} onClick={() => { resetRegions(); setImage(null); setError(''); }}>Clear photo</button>}
      </div>
    </main>
  );
}
