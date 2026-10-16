"use client";
import useSettingsLockNotice from "../SettingsLockNotice";
import PageHeader from "../PageHeader";
import Link from "@/lib/AppLink";

import AppIcon from "../AppIcon";
import { applyCopticCase, COPTIC_KEYBOARD_LAYOUTS, CopticKeyboardGrid, isCopticKey, isCopticSpecialKey, updateInputAtSelection, type CopticKey, type CopticKeyboardMode, type CopticShiftMode } from "../CopticKeyboard";

import {copyText} from "@/lib/nativeExperience";
import ReferenceDetails from "./ReferenceDetails";

import { translationRequest } from "@/lib/translationService";
import { hasLocalTranslator, disposeLocalTranslator } from "@/lib/localTranslation/client";

import { type FormEvent as ReactFormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, useEffect, useRef, useState } from "react";
import {
  isCopticKeyboardEnabled,
  readCopticKeyboardSessionVisibility,
  writeCopticKeyboardSessionVisibility,
} from "../CopticKeyboardPreference";
import { isBohairicOnlyEnabled } from "../BohairicPreference";
import { subscribeToMediaQueryChange } from "@/lib/mediaQuery";

type TranslationPayload = {
  translation?: string;
  confidence?: number;
  dialect?: "sahidic" | "bohairic";
  error?: string;
  details?: string;
  method?: string;
  matchedText?: string;
  sourceRow?: string;
  segments?: { text: string; translation: string }[];
};

type TranslationDirection = "copticToEnglish" | "englishToCoptic";

export default function TranslatorPage() {
  const {show:showLock,notice}=useSettingsLockNotice();
  const [localTranslationEnabled, setLocalTranslationEnabled] = useState(false);
  useEffect(() => {
    void hasLocalTranslator().then(setLocalTranslationEnabled);
    return disposeLocalTranslator;
  }, []);
  const [direction, setDirection] = useState<TranslationDirection>("copticToEnglish");
  const [translationMethod, setTranslationMethod] = useState<'published' | 'experimental'>('published');
  const [translationProgress, setTranslationProgress] = useState('');
  const [draftSegments, setDraftSegments] = useState<{ text: string; translation: string }[]>([]);
  const [outputMethod, setOutputMethod] = useState('');
  const [referenceDetails, setReferenceDetails] = useState<{ text?: string; row?: string }>({});
  const [translationInput, setTranslationInput] = useState("");
  const [translatorDialect, setTranslatorDialect] = useState<"sahidic" | "bohairic">("bohairic");
  const [bohairicOnlyEnabled, setGlobalBohairicOnlyEnabled] = useState(true);
  const [translationState, setTranslationState] = useState<"idle" | "loading" | "error">("idle");
  const [translationError, setTranslationError] = useState("");
  const [translationOutput, setTranslationOutput] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [englishInput, setEnglishInput] = useState("");
  const [englishState, setEnglishState] = useState<"idle" | "loading" | "error">("idle");
  const [englishError, setEnglishError] = useState("");
  const [englishOutput, setEnglishOutput] = useState("");
  const [englishConfidence, setEnglishConfidence] = useState<number | null>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mode, setMode] = useState<CopticKeyboardMode>("ABC");
  const [shiftMode, setShiftMode] = useState<CopticShiftMode>("off");
  useEffect(() => {
    setTranslationOutput(''); setConfidence(null); setTranslationError('');
    setDraftSegments([]); setReferenceDetails({}); setOutputMethod('');
  }, [translationInput, translatorDialect]);
  useEffect(() => { setEnglishOutput(''); setEnglishConfidence(null); setEnglishError(''); }, [englishInput, translatorDialect]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastShiftTapRef = useRef<number>(0);
  const mobileKeyboardTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const mobileKeyboardCloseTimerRef = useRef<number | null>(null);
  const [mobileKeyboardDragY, setMobileKeyboardDragY] = useState(0);
  const [mobileKeyboardIsDragging, setMobileKeyboardIsDragging] = useState(false);
  const [mobileKeyboardIsClosing, setMobileKeyboardIsClosing] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobileViewport(mql.matches);
    update();
    return subscribeToMediaQueryChange(mql, update);
  }, []);

  useEffect(() => {
    const enabled = isCopticKeyboardEnabled();
    const mobileViewport = window.matchMedia("(max-width: 768px)").matches;
    setKeyboardEnabled(enabled);
    setShowKeyboard(enabled && !mobileViewport ? readCopticKeyboardSessionVisibility(true) : false);

    const bohairicOnly = isBohairicOnlyEnabled();
    setGlobalBohairicOnlyEnabled(bohairicOnly);
    if (bohairicOnly) {
      setTranslatorDialect("bohairic");
    }
  }, []);

  useEffect(() => {
    if (!bohairicOnlyEnabled) {
      return;
    }

    setTranslatorDialect("bohairic");
  }, [bohairicOnlyEnabled]);

  useEffect(() => {
    return () => {
      if (mobileKeyboardCloseTimerRef.current !== null) {
        window.clearTimeout(mobileKeyboardCloseTimerRef.current);
      }
    };
  }, []);

  const hideKeyboardOnManualInputFocus = (event: ReactPointerEvent<HTMLTextAreaElement>) => {
    if (!keyboardEnabled || !isMobileViewport || !showKeyboard) return;
    event.currentTarget.readOnly = false;
    event.currentTarget.inputMode = "text";
    setShowKeyboard(false);
    writeCopticKeyboardSessionVisibility(false);
    event.currentTarget.focus({ preventScroll: true });
  };

  const setKeyboardVisibility = (visible: boolean) => {
    if (mobileKeyboardCloseTimerRef.current !== null) {
      window.clearTimeout(mobileKeyboardCloseTimerRef.current);
      mobileKeyboardCloseTimerRef.current = null;
    }

    if (visible) {
      setMobileKeyboardDragY(0);
      setMobileKeyboardIsDragging(false);
      setMobileKeyboardIsClosing(false);
    }

    setShowKeyboard(visible);
    writeCopticKeyboardSessionVisibility(visible);
  };

  const closeMobileKeyboardWithAnimation = () => {
    if (!showKeyboard || !isMobileViewport) {
      setKeyboardVisibility(false);
      return;
    }

    if (mobileKeyboardCloseTimerRef.current !== null) {
      window.clearTimeout(mobileKeyboardCloseTimerRef.current);
    }

    setMobileKeyboardIsDragging(false);
    setMobileKeyboardIsClosing(true);
    setMobileKeyboardDragY(360);
    mobileKeyboardCloseTimerRef.current = window.setTimeout(() => {
      mobileKeyboardCloseTimerRef.current = null;
      setMobileKeyboardIsClosing(false);
      setMobileKeyboardDragY(0);
      setKeyboardVisibility(false);
    }, 180);
  };

  const handleMobileKeyboardTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1 || mobileKeyboardIsClosing) {
      mobileKeyboardTouchStartRef.current = null;
      setMobileKeyboardIsDragging(false);
      return;
    }

    const touch = event.touches[0];
    mobileKeyboardTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setMobileKeyboardIsDragging(true);
  };

  const handleMobileKeyboardTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const start = mobileKeyboardTouchStartRef.current;
    if (!start || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const deltaY = Math.max(0, touch.clientY - start.y);
    const deltaX = Math.abs(touch.clientX - start.x);

    if (deltaY <= 0 || deltaY < deltaX * 0.35) {
      setMobileKeyboardDragY(0);
      return;
    }

    setMobileKeyboardDragY(Math.min(deltaY, 360));
  };

  const handleMobileKeyboardTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = mobileKeyboardTouchStartRef.current;
    mobileKeyboardTouchStartRef.current = null;
    setMobileKeyboardIsDragging(false);

    if (!start || event.changedTouches.length !== 1) {
      setMobileKeyboardDragY(0);
      return;
    }

    const touch = event.changedTouches[0];
    const deltaY = touch.clientY - start.y;
    const deltaX = Math.abs(touch.clientX - start.x);

    if (deltaY > 60 && deltaY > deltaX * 1.2) {
      closeMobileKeyboardWithAnimation();
      return;
    }

    setMobileKeyboardDragY(0);
  };

  const handleMobileKeyboardTouchCancel = () => {
    mobileKeyboardTouchStartRef.current = null;
    setMobileKeyboardIsDragging(false);
    setMobileKeyboardDragY(0);
  };

  const page = COPTIC_KEYBOARD_LAYOUTS[mode];
  const isCopticMode = mode === "ABC";

  const applyShiftToChar = (ch: string) => {
    if (!isCopticMode || !isCopticKey(ch) || shiftMode === "off") return ch;
    const out = applyCopticCase(ch);
    if (shiftMode === "once") setShiftMode("off");
    return out;
  };

  const displayKey = (k: CopticKey) => {
    if (isCopticSpecialKey(k)) return k.label ?? "";
    if (!isCopticMode || !isCopticKey(k) || shiftMode === "off") return k;
    return applyCopticCase(k);
  };

  const handleShiftTap = () => {
    const now = Date.now();
    const delta = now - lastShiftTapRef.current;
    lastShiftTapRef.current = now;
    if (shiftMode === "lock") {
      setShiftMode("off");
      return;
    }
    if (delta > 0 && delta < 350) {
      setShiftMode("lock");
      return;
    }
    setShiftMode((prev) => (prev === "off" ? "once" : "off"));
  };

  const runCurrentTranslation = () => {
    setCopyStatus('');
    if (isCopticToEnglish) {
      void runTranslation();
      return;
    }
    void runEnglishToCopticTranslation();
  };

  const handleSubmit = (event: ReactFormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runCurrentTranslation();
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || currentState === "loading") {
      return;
    }

    event.preventDefault();
    runCurrentTranslation();
  };

  const handleKey = (k: CopticKey) => {
    if (currentState === "loading") return;
    if (isCopticSpecialKey(k)) {
      switch (k.key) {
        case "backspace":
          updateInputAtSelection(inputRef.current, translationInput, null, setTranslationInput);
          return;
        case "shift":
          if (isCopticMode) handleShiftTap();
          return;
        case "space":
          updateInputAtSelection(inputRef.current, translationInput, " ", setTranslationInput);
          return;
        case "return":
          runCurrentTranslation();
          return;
        case "toABC":
          setMode("ABC");
          setShiftMode("off");
          return;
        case "toNumbers":
          setMode("NUMBERS");
          setShiftMode("off");
          return;
        case "toSymbols":
          setMode("SYMBOLS");
          setShiftMode("off");
          return;
      }
    }

    const out = applyShiftToChar(typeof k === "string" ? k : "");
    if (!out) return;
    updateInputAtSelection(inputRef.current, translationInput, out, setTranslationInput);
  };

  const runTranslation = async () => {
    const text = translationInput.trim();
    if (!text) {
      setTranslationError("Enter Coptic text to translate.");
      setTranslationOutput("");
      setConfidence(null);
      setTranslationState("error");
      return;
    }

    setTranslationState("loading");
    setTranslationProgress("Preparing translation…");
    setTranslationError("");

    try {
      const res = await translationRequest("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          dialect: translatorDialect,
          includeConfidence: true,
          method: translationMethod,
        }),
      }, setTranslationProgress);

      const payload = (await res.json()) as TranslationPayload;
      if (!res.ok) {
        setTranslationOutput("");
        setConfidence(null);
        setTranslationState("error");

        const details = [payload.error, payload.details].filter(Boolean).join(" ");
        setTranslationError(details || "Translation request failed.");
        return;
      }

      const top = typeof payload.translation === "string" ? payload.translation.trim() : "";
      setTranslationOutput(top);
      setOutputMethod(payload.method || "");
      setDraftSegments(payload.segments || []);
      setReferenceDetails({ text: payload.matchedText, row: payload.sourceRow });
      setConfidence(typeof payload.confidence === "number" ? payload.confidence : null);
      setTranslationState("idle");
    } catch (error) {
      setTranslationOutput("");
      setConfidence(null);
      setTranslationState("error");
      setTranslationError(error instanceof Error ? error.message : "Could not reach translation service.");
    }
  };

  const runEnglishToCopticTranslation = async () => {
    const text = englishInput.trim();
    if (!text) {
      setEnglishOutput("");
      setEnglishConfidence(null);
      setEnglishError("Enter English text to translate.");
      setEnglishState("error");
      return;
    }

    setEnglishState("loading");
    setEnglishError("");

    try {
      const res = await translationRequest("/api/translate/en-coptic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, dialect: translatorDialect, includeConfidence: true }),
      });

      const payload = (await res.json()) as TranslationPayload;
      if (!res.ok) {
        setEnglishOutput("");
        setEnglishConfidence(null);
        setEnglishState("error");

        const details = [payload.error, payload.details].filter(Boolean).join(" ");
        setEnglishError(details || "Translation request failed.");
        return;
      }

      const top = typeof payload.translation === "string" ? payload.translation.trim() : "";
      setEnglishOutput(top);
      setEnglishConfidence(typeof payload.confidence === "number" ? payload.confidence : null);
      setEnglishState("idle");
    } catch (error) {
      setEnglishOutput("");
      setEnglishConfidence(null);
      setEnglishState("error");
        setEnglishError(error instanceof Error ? error.message : "Could not reach translation service.");
    }
  };

  const [copyStatus,setCopyStatus] = useState("");
  const dialectLabel = translatorDialect === "bohairic" ? "Bohairic" : "Sahidic";
  const isCopticToEnglish = direction === "copticToEnglish";
  const currentInput = isCopticToEnglish ? translationInput : englishInput;
  const currentOutput = isCopticToEnglish ? translationOutput : englishOutput;
  const currentState = isCopticToEnglish ? translationState : englishState;
  const currentError = isCopticToEnglish ? translationError : englishError;
  const currentConfidence = isCopticToEnglish ? confidence : englishConfidence;

  const handleSwitchDirection = () => {
    if (translationState === "loading" || englishState === "loading") return;
    setCopyStatus('');
    setDirection((current) => (current === "copticToEnglish" ? "englishToCoptic" : "copticToEnglish"));
  };

  const handleDialectToggle = () => {
    if (translationState === "loading" || englishState === "loading") return;
    if (bohairicOnlyEnabled) {
      showLock();
      return;
    }

    const nextDialect = translatorDialect === "bohairic" ? "sahidic" : "bohairic";
    setTranslatorDialect(nextDialect);
  };

  return (
    <main
      className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]"
      style={{
        paddingBottom: isMobileViewport && showKeyboard ? "calc(340px + env(safe-area-inset-bottom, 0px))" : undefined,
      }}
    >
      <div
        className="app-page translator-page"
        style={{
          paddingBottom: isMobileViewport && showKeyboard ? "calc(24px + env(safe-area-inset-bottom, 0px))" : undefined,
        }}
      >
        <PageHeader title="Translator" icon="translate"/>
        {notice}
        <div className="translator-quick-actions">
          <span>{bohairicOnlyEnabled ? "Bohairic-only mode" : `${dialectLabel} dialect`}</span>
          <Link className="ui-text-action" href="/translator/scanner"><AppIcon name="scan" size={18}/> Scan a photo</Link>
        </div>
        <section className="translation-input-panel" aria-label="Translation input">
          <div className="translation-direction"><span>{isCopticToEnglish?'Coptic → English':'English → Coptic'}</span><button type="button" onClick={handleSwitchDirection} disabled={currentState==='loading'} aria-label="Switch translation direction"><AppIcon name="return"/></button></div>
          <form className="translation-form" onSubmit={handleSubmit}>
            <textarea ref={inputRef} aria-label={isCopticToEnglish?'Coptic text':'English text'} disabled={currentState==='loading'} value={currentInput} onChange={event=>{setCopyStatus('');if(isCopticToEnglish){setTranslationInput(event.target.value);setTranslationOutput('');setTranslationError('');setConfidence(null);setDraftSegments([]);setReferenceDetails({});setOutputMethod('');}else{setEnglishInput(event.target.value);setEnglishOutput('');setEnglishError('');setEnglishConfidence(null);}}} onKeyDown={handleInputKeyDown} onPointerDownCapture={hideKeyboardOnManualInputFocus} placeholder={isCopticToEnglish?'Type Coptic text...':'Type English text...'} className={isCopticToEnglish?'coptic-text':''} autoCorrect="off" autoCapitalize="none" spellCheck={false}/>
            <button type="submit" className="ui-primary" disabled={currentState==='loading'}>{currentState==='loading'?'Translating…':'Translate'}{currentState!=='loading'&&<AppIcon name="arrow" size={18}/>}</button>
          </form>
          {isCopticToEnglish&&currentState==='loading'&&<p role="status" className="mt-3 text-sm">{translationProgress}</p>}
        </section>
        {currentState==='error'&&<p role="alert" className="translation-error">{currentError}</p>}
        <section className="translation-result" aria-label="Translation result" aria-live="polite">
          <div className="translation-result-header"><span>{isCopticToEnglish&&currentOutput?outputMethod==='published'?'Published translation · Coptic Corpora / Tasbeha':'Unverified AI draft':'Translation'}</span>
            {currentOutput&&<button type="button" aria-label="Copy translation" onClick={()=>{void copyText(currentOutput).then(()=>setCopyStatus('Copied')).catch(()=>setCopyStatus('Could not copy. Select the text to copy it.'));}}><AppIcon name="copy" size={16}/>{copyStatus==='Copied'?'Copied':'Copy'}</button>}</div>
          <p className={!isCopticToEnglish&&currentOutput?'coptic-text':!currentOutput?'text-[var(--text-muted)]':''}>{currentOutput || (currentState === "idle" && currentInput.trim() && isCopticToEnglish && outputMethod === "published" ? "No published match for this text. Try a shorter passage, or choose an experimental draft in Translation options." : "Your translation will appear here.")}</p>
          {copyStatus&&<span role="status" className={copyStatus==='Copied'?'sr-only':'text-sm'}>{copyStatus}</span>}
          {isCopticToEnglish&&currentOutput&&outputMethod==='published'&&<ReferenceDetails {...referenceDetails}/>}
          {isCopticToEnglish&&currentOutput&&outputMethod==='experimental'&&<p className="translation-help">Experimental translation. Check the meaning before relying on it.</p>}
          {isCopticToEnglish&&currentOutput&&outputMethod==='experimental'&&draftSegments.length>1&&<details className="translation-help"><summary>Review each draft passage</summary>{draftSegments.map((segment,index)=><div key={index}><p className="coptic-text">{segment.text}</p><p>{segment.translation}</p></div>)}</details>}
          {currentConfidence!==null&&<p className="translation-help">Confidence: {(currentConfidence*100).toFixed(1)}%</p>}
        </section>
        <details className="translation-help"><summary>About translation & offline use</summary><p>Published text returns an existing translation when the letters match a supported passage. It does not guess missing text. Experimental AI drafts can contain wrong meanings.</p><p>Coptic → English runs on this device, including offline, when the translation model is installed. English → Coptic uses the configured online service. Bohairic-only mode follows Settings.</p></details>
        <details className="translation-advanced">
          <summary>Translation options</summary>
          <div className="translation-options">
            {isCopticToEnglish && localTranslationEnabled ? <label>Method<select aria-label="Translation method" value={translationMethod} disabled={currentState === "loading"} onChange={event => { setTranslationMethod(event.target.value as typeof translationMethod); setTranslationOutput(""); setTranslationError(""); setOutputMethod(""); setCopyStatus(""); }}><option value="published">Published text match</option><option value="experimental">Experimental draft</option></select></label> : null}
            <div className="translation-dialect"><span>Dialect: {dialectLabel}</span><button type="button" onClick={handleDialectToggle} disabled={currentState === "loading" || bohairicOnlyEnabled} aria-label="Change translator dialect" title={bohairicOnlyEnabled ? "Locked by Bohairic-only mode in Settings" : "Change dialect"}>Change</button></div>
            {bohairicOnlyEnabled ? <p className="translation-option-note">Bohairic-only mode is active in Settings.</p> : null}
            {isCopticToEnglish && localTranslationEnabled ? <p className="translation-option-note">Published matches only appear when the text matches a supported passage. Experimental drafts may be wrong and are labeled unverified.</p> : null}
          </div>
        </details>

      </div>

      {keyboardEnabled && isMobileViewport && showKeyboard && isCopticToEnglish ? (
        <div
          onTouchStart={handleMobileKeyboardTouchStart}
          onTouchMove={handleMobileKeyboardTouchMove}
          onTouchEnd={handleMobileKeyboardTouchEnd}
          onTouchCancel={handleMobileKeyboardTouchCancel}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            padding: "0 10px calc(8px + env(safe-area-inset-bottom, 0px))",
            touchAction: "none",
            overscrollBehavior: "contain",
            transform: `translateY(${mobileKeyboardDragY}px)`,
            opacity: Math.max(0.72, 1 - mobileKeyboardDragY / 420),
            transition: mobileKeyboardIsDragging ? "none" : "transform 180ms ease, opacity 180ms ease",
            willChange: "transform, opacity",
          }}
        >
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={closeMobileKeyboardWithAnimation}
              className="rounded-full border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-2 text-xs font-medium text-[var(--text-color)] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            >
              Hide Coptic keyboard
            </button>
          </div>
          <CopticKeyboardGrid page={page} handleKey={handleKey} displayKey={displayKey} shiftMode={shiftMode} mobile />
        </div>
      ) : null}

      {keyboardEnabled && isMobileViewport && !showKeyboard && isCopticToEnglish ? (
        <div className="mobile-chin-avoid fixed bottom-4 right-4 z-50">
          <button
            type="button"
            onClick={() => setKeyboardVisibility(true)}
            className="rounded-full border border-[var(--border-color)] bg-[var(--panel-bg)] px-4 py-2 text-xs font-medium text-[var(--text-color)] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          >
            Show Coptic keyboard
          </button>
        </div>
      ) : null}
    </main>
  );
}

