"use client";
import {searchBrowseDictionary, peekBrowseDictionary, type BrowseEntry} from "@/lib/dictionary/browseClient";
import PageHeader from "../PageHeader";
import { applyCopticCase, COPTIC_KEYBOARD_LAYOUTS, CopticKeyboardGrid, isCopticKey, isCopticSpecialKey, updateInputAtSelection, type CopticKey, type CopticKeyboardMode, type CopticShiftMode } from "../CopticKeyboard";

import AppIcon from "../AppIcon";
import Link from "@/lib/AppLink";
import { readDictionaryOptions } from "@/lib/dictionary/preferences";
import { COPTIC_ALPHABET } from "@/lib/dictionary/search.mjs";

import { type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, type CSSProperties, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  isCopticKeyboardEnabled,
  readCopticKeyboardSessionVisibility,
  writeCopticKeyboardSessionVisibility,
} from "../CopticKeyboardPreference";
import { isBohairicOnlyEnabled } from "../BohairicPreference";
import { subscribeToMediaQueryChange } from "@/lib/mediaQuery";

const POS_LABELS: Record<string, string> = {
  q: "Qualitative",
};

function getPosLabel(pos: string) {
  const trimmed = (pos || "").trim();
  if (!trimmed) {
    return trimmed;
  }

  return POS_LABELS[trimmed.toLowerCase()] ?? trimmed;
}

export default function DictionaryPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [ignoreMarks, setIgnoreMarks] = useState(true);
  const [initial, setInitial] = useState("");
  const [spellingSuggestions, setSpellingSuggestions] = useState(true);
  const [searchRestored, setSearchRestored] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [bohairicOnly, setBohairicOnly] = useState(true);
  const [globalBohairicOnlyEnabled, setGlobalBohairicOnlyEnabled] = useState(true);
  const [posFilter, setPosFilter] = useState("All");
  const [examplesOnly, setExamplesOnly] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [posSearch, setPosSearch] = useState("");
  const posDropdownRef = useRef<HTMLDivElement | null>(null);

  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mode, setMode] = useState<CopticKeyboardMode>("ABC");
  const [shiftMode, setShiftMode] = useState<CopticShiftMode>("off");
  const lastShiftTapRef = useRef<number>(0);
  const mobileKeyboardTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const mobileKeyboardCloseTimerRef = useRef<number | null>(null);
  const [mobileKeyboardDragY, setMobileKeyboardDragY] = useState(0);
  const [mobileKeyboardIsDragging, setMobileKeyboardIsDragging] = useState(false);
  const [mobileKeyboardIsClosing, setMobileKeyboardIsClosing] = useState(false);
  const queryInputRef = useRef<HTMLInputElement | null>(null);

  const [visibleResults, setVisibleResults] = useState<BrowseEntry[]>([]);
  const [resultKey,setResultKey] = useState('');
  const [suggestions,setSuggestions] = useState<string[]>([]);
  const [hasMore,setHasMore] = useState(false);
  const [loadingMore,setLoadingMore] = useState(false);
  const [moreError,setMoreError] = useState(false);
  const generation = useRef(0), morePending = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("coptic-dictionary-search") ?? "null");
      if (saved) {
        if (typeof saved.query === "string") setQuery(saved.query);
        if (["all", "coptic", "english", "transliteration"].includes(saved.scope)) setScope(saved.scope);
        if (typeof saved.pos === "string") setPosFilter(saved.pos);
        if (typeof saved.initial === "string" && (saved.initial === "" || Array.from(COPTIC_ALPHABET).includes(saved.initial))) setInitial(saved.initial);
        if (typeof saved.examplesOnly === "boolean") setExamplesOnly(saved.examplesOnly);
      }
      const preferences = JSON.parse(localStorage.getItem("coptic-dictionary-preferences") ?? "null");
      if (typeof preferences?.ignoreMarks === "boolean") setIgnoreMarks(preferences.ignoreMarks);
      if (typeof preferences?.suggestions === "boolean") setSpellingSuggestions(preferences.suggestions);
      const recent = JSON.parse(localStorage.getItem("coptic-dictionary-recent") ?? "[]");
      if (Array.isArray(recent)) setRecentSearches(recent.filter(x => typeof x === "string").slice(0, 8));
    } catch { /* A damaged preference must not prevent dictionary access. */ }
    setSearchRestored(true);
  }, []);
  useEffect(() => {
    if (!searchRestored) return;
    try {
      sessionStorage.setItem("coptic-dictionary-search", JSON.stringify({ query, scope, pos: posFilter, initial, examplesOnly, bohairicOnly }));
      localStorage.setItem("coptic-dictionary-preferences", JSON.stringify({ ignoreMarks, suggestions: spellingSuggestions }));
    } catch { /* Search remains usable when storage is unavailable. */ }
  }, [searchRestored, query, scope, posFilter, initial, examplesOnly, ignoreMarks, spellingSuggestions, bohairicOnly]);
  const rememberSearch = () => {
    const value = query.trim();
    if (!value) return;
    const recent = [value, ...recentSearches.filter(x => x !== value)].slice(0, 8);
    setRecentSearches(recent);
    try { localStorage.setItem("coptic-dictionary-recent", JSON.stringify(recent)); } catch {}
  };
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
        event.preventDefault(); queryInputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);


  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobileViewport(mql.matches);
    update();
    return subscribeToMediaQueryChange(mql, update);
  }, []);

  useEffect(() => {
    const keyboardIsEnabled = isCopticKeyboardEnabled();
    const mobileViewport = window.matchMedia("(max-width: 768px)").matches;
    setKeyboardEnabled(keyboardIsEnabled);
    setShowKeyboard(keyboardIsEnabled && !mobileViewport ? readCopticKeyboardSessionVisibility(true) : false);
    const globalBohairicOnly = isBohairicOnlyEnabled();
    setGlobalBohairicOnlyEnabled(globalBohairicOnly);
    setBohairicOnly(globalBohairicOnly || readDictionaryOptions().bohairicOnly);
  }, []);

  useEffect(() => {
    if (!globalBohairicOnlyEnabled) {
      return;
    }

    setBohairicOnly(true);
  }, [globalBohairicOnlyEnabled]);

  useEffect(() => {
    return () => {
      if (mobileKeyboardCloseTimerRef.current !== null) {
        window.clearTimeout(mobileKeyboardCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!posOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      const el = posDropdownRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setPosOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setPosOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [posOpen]);

  const searchOptions = useMemo(()=>({query:deferredQuery,scope,ignoreMarks,initial,bohairicOnly,examplesOnly,pos:posFilter==='All'?'':posFilter,suggestions:spellingSuggestions}),
    [deferredQuery,scope,ignoreMarks,initial,bohairicOnly,examplesOnly,posFilter,spellingSuggestions]);
  useEffect(()=>{
    if(!searchRestored)return;
    const current=++generation.current;
    morePending.current=false;setLoadingMore(false);setMoreError(false);
    const cached=peekBrowseDictionary(searchOptions);
    setLoadState(cached?'ready':'loading');
    if(cached){setResultKey(JSON.stringify(searchOptions));setVisibleResults(cached.entries);setSuggestions(cached.suggestions);setHasMore(cached.entries.length<cached.total);}
    const fontReady=cached?Promise.resolve():document.fonts?.load('30px "FreeSerifAvvaShenouda"','ⲁⲃⲅ').catch(()=>undefined);
    Promise.all([searchBrowseDictionary(searchOptions,0),fontReady]).then(([result])=>{
      if(current!==generation.current)return;
      setResultKey(JSON.stringify(searchOptions));setVisibleResults(result.entries);setSuggestions(result.suggestions);setHasMore(result.entries.length<result.total);setLoadState('ready');
    }).catch(()=>{if(current===generation.current){setVisibleResults([]);setHasMore(false);setLoadState('error');}});
    return()=>{generation.current++;};
  },[searchOptions,searchRestored,loadAttempt]);
  const loadMore=useCallback(()=>{
    if(morePending.current||!hasMore||loadState!=='ready')return;
    morePending.current=true;setLoadingMore(true);setMoreError(false);
    const current=generation.current;
    searchBrowseDictionary(searchOptions,visibleResults.length).then(result=>{
      if(current!==generation.current)return;
      setVisibleResults(previous=>[...previous,...result.entries]);setHasMore(visibleResults.length+result.entries.length<result.total);
    }).catch(()=>{if(current===generation.current)setMoreError(true);})
      .finally(()=>{if(current===generation.current){morePending.current=false;setLoadingMore(false);}});
  },[hasMore,loadState,searchOptions,visibleResults.length]);
  useEffect(()=>{
    if(!sentinel.current||!hasMore||moreError||loadState!=='ready'||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(records=>{if(records.some(record=>record.isIntersecting))loadMore();},{rootMargin:'0px 0px 600px 0px'});
    observer.observe(sentinel.current);
    return()=>observer.disconnect();
  },[hasMore,loadMore,moreError,loadState]);

  const page = COPTIC_KEYBOARD_LAYOUTS[mode];

  const isCopticMode = mode === "ABC";

  const applyShiftToChar = (ch: string) => {
    if (!isCopticMode) return ch;
    if (!isCopticKey(ch)) return ch;
    if (shiftMode === "off") return ch;
    const out = applyCopticCase(ch);
    if (shiftMode === "once") setShiftMode("off");
    return out;
  };

  const displayKey = (k: CopticKey) => {
    if (isCopticSpecialKey(k)) return k.label ?? "";
    if (!isCopticMode) return k;
    if (!isCopticKey(k)) return k;
    if (shiftMode === "off") return k;
    return applyCopticCase(k);
  };

  const shiftActive = shiftMode !== "off";
  const capsLock = shiftMode === "lock";

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

  const hideKeyboardOnManualInputFocus = (event: ReactPointerEvent<HTMLInputElement>) => {
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

  const handleKey = (k: CopticKey) => {
    if (isCopticSpecialKey(k)) {
      switch (k.key) {
        case "backspace":
          updateInputAtSelection(queryInputRef.current, query, null, setQuery);
          return;

        case "shift":
          if (isCopticMode) handleShiftTap();
          return;

        case "space":
          updateInputAtSelection(queryInputRef.current, query, " ", setQuery);
          return;

        case "return":
          queryInputRef.current?.blur();
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

    const ch = typeof k === "string" ? k : "";
    if (!ch) return;
    const out = applyShiftToChar(ch);
    updateInputAtSelection(queryInputRef.current, query, out, setQuery);
  };

  return (
    <main
      className="dictionary-page min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]"
      style={{
        paddingBottom:
          keyboardEnabled && isMobileViewport && showKeyboard
            ? "calc(340px + env(safe-area-inset-bottom, 0px))"
            : undefined,
      }}
    >
      <div
        className="mx-auto max-w-5xl px-5 pb-8 pt-4 md:py-8"
        style={{
          paddingBottom:
            keyboardEnabled && isMobileViewport && showKeyboard
              ? "calc(24px + env(safe-area-inset-bottom, 0px))"
              : undefined,
        }}
      >
        <PageHeader title="Dictionary" icon="book"/>

        <div className="mt-5 space-y-3">
          <label className="dictionary-search-shell flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-3">
            <AppIcon name="search" size={20}/>
            <input
              ref={queryInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={rememberSearch}
              onKeyDown={e => { if (e.key === "Enter") { rememberSearch(); e.currentTarget.blur(); } }}
              onPointerDownCapture={hideKeyboardOnManualInputFocus}
              readOnly={keyboardEnabled && isMobileViewport && showKeyboard}
              inputMode={keyboardEnabled && isMobileViewport && showKeyboard ? "none" : "text"}
              aria-label="Dictionary search"
              placeholder="Search Coptic, English, or transliteration..."
              className={`dictionary-search-input ${/\p{Script=Coptic}/u.test(query) ? "coptic-text" : ""} w-full min-w-0 bg-transparent text-base outline-none placeholder:text-[var(--text-soft)]`}
            />
          </label>

          <div className="flex items-center justify-between gap-3 text-sm">
            <Link href="/dictionary/settings/" className="ui-text-action"><AppIcon name="settings" size={18}/>Advanced dictionary settings</Link>
            <button type="button" onClick={() => { setQuery(""); queryInputRef.current?.focus({ preventScroll: true }); }} className="min-h-11 px-3 text-[var(--text-muted)]">Clear</button>
          </div>
          {suggestions.length > 0 && <div className="flex flex-wrap items-center gap-2 text-sm" aria-label="Spelling suggestions">Try:
            {suggestions.map(word => <button key={word} type="button" onClick={() => setQuery(word)} className="coptic-text rounded-xl border border-[var(--border-color)] px-3 py-2">{word}</button>)}
          </div>}

          {recentSearches.length > 0 && <details className="text-sm text-[var(--text-muted)]"><summary>Recent searches</summary>
            <div className="mt-2 flex flex-wrap gap-2">{recentSearches.map(word => <button key={word} type="button" onClick={() => setQuery(word)} className="coptic-text rounded-xl border border-[var(--border-color)] px-3 py-2">{word}</button>)}
              <button type="button" onClick={() => { setRecentSearches([]); try { localStorage.removeItem("coptic-dictionary-recent"); } catch {} }} className="px-3 py-2 underline">Clear recent searches</button>
            </div></details>}
          {loadState==='error'&&<p role="alert" className="text-sm text-[var(--lesson-choice-wrong-text)]">Failed to load dictionary files. <button type="button" onClick={()=>setLoadAttempt(n=>n+1)} className="ml-2 min-h-11 underline">Retry</button></p>}
        </div>

        <div className="dictionary-results" role="region" aria-label="Dictionary entries" aria-busy={loadState==='loading'} data-state={loadState}>
          {loadState==='loading'&&visibleResults.length===0&&<div className="dictionary-loading" role="status" aria-label="Loading dictionary"><span className="sr-only">Loading dictionary…</span>{[0,1,2].map(n=><div key={n} className="dictionary-placeholder" aria-hidden="true"><i/><i/><i/></div>)}</div>}
          {visibleResults.map((e, idx) => (
            <div
              key={resultKey+`-${e.dialect}-${e.lemma}-${e.pos}-${idx}`}
              className="dictionary-entry-card dictionary-entry-arrival"
              style={{'--entry-delay':`${Math.min(idx%24,5)*30}ms`} as CSSProperties}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/dictionary/entry/?lemma=${encodeURIComponent(e.lemma)}`} className="coptic-text text-2xl font-semibold tracking-tight underline-offset-4 hover:underline">{e.lemma}</Link>
                  {e.matchLabel && <p className="mt-1 text-sm text-[var(--text-muted)]">{e.matchLabel}{e.matchEvidence ? <> · <span className="coptic-text">{e.matchEvidence}</span></> : null}</p>}

                  {e.forms.length > 1 && (
                    <div className="mt-1 text-sm text-[var(--text-muted)]">
                      Forms:{" "}
                      <span className="coptic-text text-[var(--text-muted)]">
                        {e.forms.filter((x) => x !== e.lemma).join(", ")}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "rounded-full border px-3 py-1 text-xs",
                        e.dialect === "boh"
                          ? ""
                          : "border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-muted)]",
                      ].join(" ")}
                      style={
                        e.dialect === "boh"
                          ? {
                              borderColor: "var(--bohairic-badge-border)",
                              background: "var(--bohairic-badge-bg)",
                              color: "var(--bohairic-badge-text)",
                            }
                          : undefined
                      }
                    >
                      {e.dialect === "boh" ? "Bohairic" : "Unknown"}
                    </span>

	                    {e.pos ? (
	                      <span className="rounded-full border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-1 text-xs text-[var(--text-muted)]">
	                        {getPosLabel(e.pos)}
	                      </span>
                    ) : null}
                  </div>


                </div>
              </div>

              <div className="mt-4">
                {e.gloss.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-[var(--text-color)]">
                    {e.gloss.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-[var(--text-soft)]">No gloss.</div>
                )}
              </div>

              {e.examples && e.examples.length > 0 ? (
                <div className="mt-5">
                  <div className="text-sm font-semibold text-[var(--text-muted)]">
                    Examples
                  </div>
                  <div className="mt-3 space-y-3">
                    {e.examples.slice(0, 5).map((ex, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-2)] p-4"
                      >
                        <div className="coptic-text text-[var(--text-color)]">{ex.sentence}</div>
                        <div className="mt-2 text-[var(--text-muted)]">{ex.translation}</div>
                        {ex.source ? (
                          <div className="mt-2 text-xs text-[var(--text-soft)]">
                            {ex.source}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {e.hasExamples ? (
                <div className="mt-4 text-sm text-[var(--text-muted)]">
                  <span className="rounded-full border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-1 text-xs text-[var(--text-muted)]">
                    Includes examples
                  </span>
                </div>
              ) : null}
            </div>
          ))}
          {loadState === "ready" && visibleResults.length === 0 && <p role="status" className="rounded-2xl border border-[var(--border-color)] p-5 text-[var(--text-muted)]">No matching entries. Try a suggested spelling, change the search scope, or clear the filters.</p>}
          {hasMore&&<div ref={sentinel} className="dictionary-scroll-sentinel">
            {loadingMore&&<span role="status">Loading more words…</span>}
            {moreError?<button type="button" className="ui-secondary" onClick={loadMore}>Retry loading more words</button>:<button type="button" className="dictionary-load-more" onClick={loadMore} disabled={loadingMore}>Load more dictionary entries</button>}
          </div>}
        </div>
      </div>

      {keyboardEnabled && isMobileViewport && showKeyboard ? (
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

      {keyboardEnabled && isMobileViewport && !showKeyboard ? (
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
