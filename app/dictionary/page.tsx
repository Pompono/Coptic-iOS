"use client";

import AppIcon from "../AppIcon";

import { type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  isCopticKeyboardEnabled,
  readCopticKeyboardSessionVisibility,
  writeCopticKeyboardSessionVisibility,
} from "../CopticKeyboardPreference";
import { isBohairicOnlyEnabled } from "../BohairicPreference";
import { subscribeToMediaQueryChange } from "@/lib/mediaQuery";

type BohExample = { sentence: string; translation: string; source?: string };
type BohairicEntryRaw = {
  word: string;
  tla_id?: string;
  entry_url?: string;
  bohairic_variants?: string[];
  pos?: string;
  scriptorium_tag?: string;
  greek_origin?: string;
  senses?: string[];
  bohairic_examples?: BohExample[];
};

type CombinedEntryRaw = {
  lemma: string;
  forms?: string[];
  pos?: string;
  gloss?: string[];
  hasGloss?: boolean;
  source?: string;
  license?: string;
};

type Entry = {
  lemma: string;
  forms: string[];
  pos: string;
  gloss: string[];
  dialect: "boh" | "unknown";
  entryUrl?: string;
  tag?: string;
  greek?: string;
  examples?: BohExample[];
  searchBlob: string;
  normalizedPos: string;
  hasExamples: boolean;
};

type SpecialKey =
  | "backspace"
  | "shift"
  | "space"
  | "return"
  | "toABC"
  | "toNumbers"
  | "toSymbols";

type KeyDef =
  | string
  | {
      key: SpecialKey;
      label?: string;
    };

type PageMode = "ABC" | "NUMBERS" | "SYMBOLS";

const POS_LABELS: Record<string, string> = {
  q: "Qualitative",
};

function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFKC").trim();
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const t = (x ?? "").toString().trim();
    if (!t) continue;
    const k = t.normalize("NFKC");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function removeLastChar(s: string) {
  const chars = Array.from(s);
  chars.pop();
  return chars.join("");
}

function isKeyObj(k: KeyDef): k is { key: SpecialKey; label?: string } {
  return typeof k !== "string";
}

function getPosLabel(pos: string) {
  const trimmed = (pos || "").trim();
  if (!trimmed) {
    return trimmed;
  }

  return POS_LABELS[trimmed.toLowerCase()] ?? trimmed;
}

const COPTIC_CASE_MAP: Record<string, string> = {
  "Ϧ": "ϧ",
  "ϧ": "Ϧ",
  "Ⲁ": "ⲁ",
  "ⲁ": "Ⲁ",
  "Ⲃ": "ⲃ",
  "ⲃ": "Ⲃ",
  "Ⲅ": "ⲅ",
  "ⲅ": "Ⲅ",
  "Ⲇ": "ⲇ",
  "ⲇ": "Ⲇ",
  "Ⲉ": "ⲉ",
  "ⲉ": "Ⲉ",
  "Ⲍ": "ⲍ",
  "ⲍ": "Ⲍ",
  "Ⲏ": "ⲏ",
  "ⲏ": "Ⲏ",
  "Ⲑ": "ⲑ",
  "ⲑ": "Ⲑ",
  "Ⲓ": "ⲓ",
  "ⲓ": "Ⲓ",
  "Ⲕ": "ⲕ",
  "ⲕ": "Ⲕ",
  "Ⲗ": "ⲗ",
  "ⲗ": "Ⲗ",
  "Ⲙ": "ⲙ",
  "ⲙ": "Ⲙ",
  "Ⲛ": "ⲛ",
  "ⲛ": "Ⲛ",
  "Ⲝ": "ⲝ",
  "ⲝ": "Ⲝ",
  "Ⲟ": "ⲟ",
  "ⲟ": "Ⲟ",
  "Ⲡ": "ⲡ",
  "ⲡ": "Ⲡ",
  "Ⲣ": "ⲣ",
  "ⲣ": "Ⲣ",
  "Ⲥ": "ⲥ",
  "ⲥ": "Ⲥ",
  "Ⲧ": "ⲧ",
  "ⲧ": "Ⲧ",
  "Ⲩ": "ⲩ",
  "ⲩ": "Ⲩ",
  "Ⲫ": "ⲫ",
  "ⲫ": "Ⲫ",
  "Ⲭ": "ⲭ",
  "ⲭ": "Ⲭ",
  "Ⲯ": "ⲯ",
  "ⲯ": "Ⲯ",
  "Ⲱ": "ⲱ",
  "ⲱ": "Ⲱ",
  "Ϣ": "ϣ",
  "ϣ": "Ϣ",
  "Ϥ": "ϥ",
  "ϥ": "Ϥ",
  "Ϩ": "ϩ",
  "ϩ": "Ϩ",
  "Ϫ": "ϫ",
  "ϫ": "Ϫ",
  "Ϭ": "ϭ",
  "ϭ": "Ϭ",
  "Ϯ": "ϯ",
  "ϯ": "Ϯ",
};

const isCopticLetter = (ch: string) => !!COPTIC_CASE_MAP[ch];

function IconBackspace({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 5H11c-.6 0-1.1.3-1.5.8L4 12l5.5 6.2c.4.5.9.8 1.5.8h9c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm-2.6 10.2-1.2 1.2L14 14.2l-2.2 2.2-1.2-1.2L12.8 13l-2.2-2.2 1.2-1.2L14 11.8l2.2-2.2 1.2 1.2L15.2 13l2.2 2.2Z"
      />
    </svg>
  );
}

function IconShift({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3 4 11h5v6h6v-6h5L12 3Zm1 12H11v-6H9.5L12 6.5 14.5 9H13v6Z"
      />
    </svg>
  );
}

const KB_ABC: KeyDef[][] = [
  ["ϧ", "ⲱ", "ⲉ", "ⲣ", "ⲧ", "ⲏ", "ⲩ", "ⲓ", "ⲟ", "ⲡ"],
  ["ⲁ", "ϣ", "ⲇ", "ⲫ", "ⲅ", "ϩ", "ϫ", "ⲕ", "ⲗ", "ⲑ"],
  ["ⲍ", "ⲝ", "ⲥ", "ϥ", "ⲃ", "ⲛ", "ⲙ", "ⲭ"],
  [{ key: "shift" }, "ⲯ", "ϭ", "ϯ", { key: "backspace" }],
  [{ key: "toNumbers", label: "ⲁ̅ⲃ̅ⲅ̅" }, "̀", { key: "space" }, { key: "return" }],
];

const KB_NUMBERS: KeyDef[][] = [
  ["ⲁ̅", "ⲃ̅", "ⲅ̅", "ⲇ̅", "ⲉ̅", "ⲋ̅", "ⲍ̅", "ⲏ̅", "ⲑ̅", "ⲓ̅"],
  ["ⲕ̅", "ⲗ̅", "ⲙ̅", "ⲛ̅", "ⲝ̅", "ⲟ̅", "ⲡ̅", "ϥ̅", "ⲣ̅"],
  ["ⲥ̅", "ⲧ̅", "ⲩ̅", "ⲫ̅", "ⲭ̅", "ⲯ̅", "ⲱ̅", "ϣ̅", { key: "backspace" }],
  [".", "⳾", ":", "–", "⸗", { key: "backspace" }],
  [{ key: "toSymbols", label: "#+=" }, { key: "toABC", label: "ⲁ̅ⲃ̅ⲅ̅" }, { key: "space" }, { key: "return" }],
];

const KB_SYMBOLS: KeyDef[][] = [
  ["̈", "॓", "̂", "︤", "̄", "︥", "̅", "̿", "̇", "̣"],
  ["́", "̑", "͡", "⳽", "𐋠", "⳰", "⳯", "⳱", "︦", "⸗"],
  ["[", "]", "{", "}", "(", ")", "^", "*", "+", "=", { key: "backspace" }],
  ["|", "~", "-", "_", "<", ">", "”", "’", "!", "?"],
  [{ key: "toABC", label: "ⲁ̅ⲃ̅ⲅ̅" }, ";", ":", "@", "#", "&", ",", ".", "$", "\\", "/", "%", { key: "space" }, { key: "return" }],
];

export default function DictionaryPage() {
  const [query, setQuery] = useState("");
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
  const [mode, setMode] = useState<PageMode>("ABC");
  const [shiftMode, setShiftMode] = useState<"off" | "once" | "lock">("off");
  const lastShiftTapRef = useRef<number>(0);
  const mobileKeyboardTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const mobileKeyboardCloseTimerRef = useRef<number | null>(null);
  const [mobileKeyboardDragY, setMobileKeyboardDragY] = useState(0);
  const [mobileKeyboardIsDragging, setMobileKeyboardIsDragging] = useState(false);
  const [mobileKeyboardIsClosing, setMobileKeyboardIsClosing] = useState(false);
  const queryInputRef = useRef<HTMLInputElement | null>(null);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [resultsLimit, setResultsLimit] = useState(80);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoadState("loading");

        const bohRes = await fetch("/bohairic_dictionary.json", {
          cache: "no-store",
        });
        const bohRaw = (await bohRes.json()) as BohairicEntryRaw[];

        const comboRes = await fetch("/coptic_dictionary_combined.json", {
          cache: "no-store",
        });
        const comboRaw = (await comboRes.json()) as CombinedEntryRaw[];

        const bohEntries: Entry[] = bohRaw.map((r) => {
          const gloss = uniqueStrings(r.senses ?? []);
          const forms = uniqueStrings([r.word, ...(r.bohairic_variants ?? [])]);

          return {
            lemma: r.word,
            forms,
            pos: r.pos ?? "",
            gloss,
            dialect: "boh",
            entryUrl: r.entry_url,
            tag: r.scriptorium_tag,
            greek: r.greek_origin,
            examples: r.bohairic_examples ?? [],
            searchBlob: norm([r.word, ...forms, ...gloss].join(" ")),
            normalizedPos: (r.pos ?? "").trim(),
            hasExamples: !!(r.bohairic_examples && r.bohairic_examples.length > 0),
          };
        });

        const comboEntries: Entry[] = comboRaw.map((r) => {
          const gloss = uniqueStrings(r.gloss ?? []);
          const forms = uniqueStrings([r.lemma, ...(r.forms ?? [])]);

          return {
            lemma: r.lemma,
            forms,
            pos: r.pos ?? "",
            gloss,
            dialect: "unknown",
            searchBlob: norm([r.lemma, ...forms, ...gloss].join(" ")),
            normalizedPos: (r.pos ?? "").trim(),
            hasExamples: false,
          };
        });

        if (!cancelled) {
          setEntries([...bohEntries, ...comboEntries]);
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setResultsLimit(80);
  }, [deferredQuery, bohairicOnly, posFilter, examplesOnly]);

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
    setBohairicOnly(globalBohairicOnly);
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

  const allPos = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const p = (e.pos || "").trim();
      if (p) set.add(p);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = norm(deferredQuery);

    const byText = entries.filter((e) => {
      if (!q) return true;
      return e.searchBlob.includes(q);
    });

    const byDialect = bohairicOnly
      ? byText.filter((e) => e.dialect === "boh")
      : byText;

    const byPos =
      posFilter === "All"
        ? byDialect
        : byDialect.filter((e) => e.normalizedPos === posFilter);

    const byExamples = examplesOnly ? byPos.filter((e) => e.hasExamples) : byPos;

    return byExamples
      .slice()
      .sort((a, b) => {
        if (a.dialect !== b.dialect) return a.dialect === "boh" ? -1 : 1;
        return a.lemma.localeCompare(b.lemma);
      });
  }, [entries, deferredQuery, bohairicOnly, posFilter, examplesOnly]);

  const posCounts = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;

    const base = bohairicOnly
      ? entries.filter((e) => e.dialect === "boh")
      : entries.slice();

    const textFiltered = base.filter((e) => {
      const q = norm(deferredQuery);
      if (!q) return true;
      return e.searchBlob.includes(q);
    });

    const examplesFiltered = examplesOnly
      ? textFiltered.filter((e) => e.hasExamples)
      : textFiltered;

    for (const e of examplesFiltered) {
      const p = e.normalizedPos || "(unspecified)";
      map.set(p, (map.get(p) ?? 0) + 1);
      total += 1;
    }

    return { map, total };
  }, [entries, bohairicOnly, deferredQuery, examplesOnly]);

  const displayedPosOptions = useMemo(() => {
    const q = posSearch.trim().toLowerCase();
    const populatedPos = allPos.filter((p) => (posCounts.map.get(p) ?? 0) > 0);
    const base = ["All", ...populatedPos];
    if (!q) return base;
    return base.filter((p) =>
      p === "All" ? true : getPosLabel(p).toLowerCase().includes(q) || p.toLowerCase().includes(q)
    );
  }, [allPos, posCounts, posSearch]);

  useEffect(() => {
    if (posFilter === "All") {
      return;
    }

    if ((posCounts.map.get(posFilter) ?? 0) > 0) {
      return;
    }

    setPosFilter("All");
  }, [posFilter, posCounts]);

  const visibleResults = useMemo(
    () => filtered.slice(0, resultsLimit),
    [filtered, resultsLimit]
  );

  const hiddenResultsCount = filtered.length - visibleResults.length;

  const totalShown = filtered.length;
  const totalAll = posCounts.total;

  const page: KeyDef[][] =
    mode === "ABC" ? KB_ABC : mode === "NUMBERS" ? KB_NUMBERS : KB_SYMBOLS;

  const isCopticMode = mode === "ABC";

  const applyShiftToChar = (ch: string) => {
    if (!isCopticMode) return ch;
    if (!isCopticLetter(ch)) return ch;
    if (shiftMode === "off") return ch;
    const out = COPTIC_CASE_MAP[ch] ?? ch;
    if (shiftMode === "once") setShiftMode("off");
    return out;
  };

  const displayKey = (k: KeyDef) => {
    if (isKeyObj(k)) return k.label ?? "";
    if (!isCopticMode) return k;
    if (!isCopticLetter(k)) return k;
    if (shiftMode === "off") return k;
    return COPTIC_CASE_MAP[k] ?? k;
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

  const handleKey = (k: KeyDef) => {
    if (isKeyObj(k)) {
      switch (k.key) {
        case "backspace":
          setQuery((q) => removeLastChar(q));
          return;

        case "shift":
          if (isCopticMode) handleShiftTap();
          return;

        case "space":
          setQuery((q) => q + " ");
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
    setQuery((q) => q + out);
  };

  return (
    <main
      className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]"
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
        <h1 className="mt-0 text-4xl font-semibold tracking-tight">Coptic Dictionary</h1>
        <p className="mt-2 text-[var(--text-muted)]">Search lemma, forms, or gloss</p>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-3">
            <input
              ref={queryInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPointerDownCapture={hideKeyboardOnManualInputFocus}
              readOnly={keyboardEnabled && isMobileViewport && showKeyboard}
              inputMode={keyboardEnabled && isMobileViewport && showKeyboard ? "none" : "text"}
              placeholder="Search Coptic or English..."
              className="coptic-text w-full bg-transparent text-base outline-none placeholder:text-[var(--text-soft)]"
            />
          </div>

          {keyboardEnabled && !isMobileViewport ? (
          <div className="rounded-2xl border border-[var(--kb-border)] p-3"
            style={{ background: "var(--kb-shell)" }}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-[var(--text-muted)]">Coptic keyboard</span>
              <button
                type="button"
                onClick={() => setKeyboardVisibility(!showKeyboard)}
                className="rounded-full border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              >
                {showKeyboard ? "Hide" : "Show"}
              </button>
            </div>

            {showKeyboard ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 16,
                  background: "var(--kb-panel)",
                  border: "1px solid var(--kb-border)",
                }}
              >
                {page.map((row, rIdx) => (
                  <div
                    key={rIdx}
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "center",
                      marginBottom: rIdx === page.length - 1 ? 0 : 10,
                    }}
                  >
                    {row.map((k, i) => {
                      const obj = isKeyObj(k) ? k : null;

                      const isSpace = obj?.key === "space";
                      const isReturn = obj?.key === "return";
                      const isBackspace = obj?.key === "backspace";
                      const isShiftKey = obj?.key === "shift";

                      const flex = isSpace
                        ? 5
                        : isReturn
                        ? 2.2
                        : isBackspace || isShiftKey
                        ? 1.6
                        : obj
                        ? 1.4
                        : 1;

                      const shiftKeyBg = shiftActive ? "var(--accent-color)" : "var(--kb-key)";
                      const shiftKeyFg = shiftActive ? "var(--accent-contrast-color)" : "var(--kb-text)";

                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleKey(k)}
                          style={{
                            flex,
                            minWidth: 44,
                            height: 56,
                            borderRadius: 14,
                            background: isShiftKey
                              ? shiftKeyBg
                              : obj?.key === "return"
                              ? "var(--kb-key-return)"
                              : obj?.key === "toNumbers" || obj?.key === "toSymbols" || obj?.key === "toABC"
                              ? "var(--kb-key-alt)"
                              : "var(--kb-key)",
                            border: "1px solid var(--kb-border)",
                            color: isShiftKey ? shiftKeyFg : "var(--kb-text)",
                            fontSize: 20,
                            fontWeight: 700,
                            fontFamily: "var(--coptic-font-family)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            userSelect: "none",
                            padding: "0 10px",
                            position: "relative",
                          }}
                        >
                          {isBackspace ? (
                            <IconBackspace />
                          ) : isShiftKey ? (
                            <>
                              <IconShift />
                              {capsLock ? (
                                <span
                                  style={{
                                    position: "absolute",
                                    bottom: 8,
                                    width: 18,
                                    height: 3,
                                    borderRadius: 3,
                                    background: "var(--accent-contrast-color)",
                                    opacity: 0.9,
                                  }}
                                />
                              ) : null}
                            </>
                          ) : isReturn ? (
                            <AppIcon name="return" />
                          ) : isSpace ? (
                            ""
                          ) : (
                            <span className="coptic-text">{displayKey(k)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <div ref={posDropdownRef} className="relative min-w-[340px] flex-1">
              <button
                type="button"
                onClick={() => setPosOpen((v) => !v)}
                className="flex w-full items-center rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2"
                aria-expanded={posOpen}
                aria-haspopup="listbox"
              >
                <span className="text-sm text-[var(--text-muted)]">POS</span>
                <span className="ml-4 w-full text-left text-sm text-[var(--text-color)]">
                  {posFilter === "All" ? "All parts of speech" : getPosLabel(posFilter)}
                </span>
                <span className="ml-3 text-xs text-[var(--text-soft)]">▾</span>
              </button>

              {posOpen ? (
                <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-2xl border border-[var(--border-color)] bg-[var(--panel-bg)] p-3 shadow-[0_12px_28px_rgba(0,0,0,0.7)] backdrop-blur">
                  <input
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    placeholder="Filter parts of speech..."
                    className="mb-3 w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-color)] outline-none placeholder:text-[var(--text-soft)]"
                  />

                  <div className="pos-scrollbar max-h-80 space-y-2 overflow-auto pr-1">
                    {displayedPosOptions.map((p) => {
                      const isSelected = posFilter === p;
                      const count = p === "All" ? totalAll : posCounts.map.get(p) ?? 0;

                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setPosFilter(p);
                            setPosOpen(false);
                          }}
                          className={[
                            "group flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition",
                            isSelected
                              ? "border-[var(--text-soft)] bg-[var(--surface-2)]"
                              : "border-transparent bg-[var(--surface-1)] hover:border-[var(--border-color)] hover:bg-[var(--surface-2)]",
                          ].join(" ")}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <span className="text-sm text-[var(--text-color)]">
                            {p === "All" ? "All parts of speech" : getPosLabel(p)}
                          </span>
                          <span
                            className={[
                              "ml-3 inline-flex min-w-8 items-center justify-center rounded-full border px-2 py-0.5 text-xs",
                              isSelected
                                ? "border-[var(--text-soft)] bg-[var(--surface-2)] text-[var(--text-color)]"
                                : "border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-soft)] group-hover:text-[var(--text-color)]",
                            ].join(" ")}
                          >
                            {isSelected ? "Selected" : count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setExamplesOnly((v) => !v)}
                className="inline-flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-transparent px-4 py-2 text-sm text-[var(--text-color)]"
                aria-pressed={examplesOnly}
              >
                <span
                  className={[
                    "relative inline-flex h-7 w-12 rounded-full transition-colors",
                    examplesOnly ? "bg-[var(--text-muted)]" : "bg-white/25",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
                      examplesOnly ? "translate-x-6" : "translate-x-1",
                    ].join(" ")}
                  />
                </span>
                Has examples
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (globalBohairicOnlyEnabled) {
                      setBohairicOnly(true);
                      return;
                    }

                    setBohairicOnly((current) => !current);
                  }}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                    bohairicOnly
                      ? ""
                      : "border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]",
                    globalBohairicOnlyEnabled ? "cursor-not-allowed opacity-80" : "",
                  ].join(" ")}
                  style={
                    bohairicOnly
                      ? {
                          borderColor: "var(--bohairic-badge-border)",
                          background: "var(--bohairic-badge-bg)",
                          color: "var(--bohairic-badge-text)",
                        }
                      : undefined
                  }
                  aria-pressed={bohairicOnly}
                  aria-disabled={globalBohairicOnlyEnabled}
                  disabled={globalBohairicOnlyEnabled}
                  title={
                    globalBohairicOnlyEnabled
                      ? "Disabled while global Bohairic-only mode is enabled"
                      : "Toggle Bohairic-only dictionary results"
                  }
                  >
                    <span
                      className={[
                        "h-2.5 w-2.5 rounded-full",
                        bohairicOnly ? "" : "bg-[var(--text-soft)]",
                    ].join(" ")}
                    style={bohairicOnly ? { background: "var(--bohairic-badge-dot)" } : undefined}
                    />
                  Bohairic-only
                </button>
              </div>
            </div>

            <div className="text-sm text-[var(--text-muted)]">
              {loadState === "loading" ? (
                <span>Loading…</span>
              ) : loadState === "error" ? (
                <span className="text-red-300">Failed to load dictionary files.</span>
              ) : (
                <span>
                  {totalShown} shown • {totalAll} total •{" "}
                  <span className="text-[var(--text-muted)]">
                    Badge: <b>Bohairic</b> = verified Bohairic; <b>Unknown</b> = dialect not guaranteed.
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {visibleResults.map((e, idx) => (
            <div
              key={`${e.dialect}-${e.lemma}-${e.pos}-${idx}`}
              className="rounded-3xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="coptic-text text-2xl font-semibold tracking-tight">{e.lemma}</div>

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

                  <div className="mt-2 text-sm text-[var(--text-muted)]">
                    {e.tag ? <span className="mr-3">Tag: {e.tag}</span> : null}
                    {e.greek ? <span>Greek: {e.greek}</span> : null}
                    {e.entryUrl ? (
                      <a
                        href={e.entryUrl}
                        className="ml-3 text-[var(--text-muted)] underline decoration-[var(--text-soft)] underline-offset-4 hover:text-[var(--text-color)]"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View entry
                      </a>
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
          {hiddenResultsCount > 0 ? (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4 text-center text-sm text-[var(--text-muted)]">
              Showing {visibleResults.length} of {filtered.length} matches.
              <button
                type="button"
                onClick={() => setResultsLimit((current) => current + 80)}
                className="ml-2 rounded-full border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-1 text-[var(--text-color)] hover:bg-[var(--surface-1)]"
              >
                Show 80 more
              </button>
            </div>
          ) : null}
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
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              background: "var(--kb-panel)",
              border: "1px solid var(--kb-border)",
            }}
          >
            {page.map((row, rIdx) => (
              <div
                key={rIdx}
                style={{
                  display: "flex",
                  gap: 6,
                  justifyContent: "center",
                  marginBottom: rIdx === page.length - 1 ? 0 : 8,
                }}
              >
                {row.map((k, i) => {
                  const obj = isKeyObj(k) ? k : null;

                  const isSpace = obj?.key === "space";
                  const isReturn = obj?.key === "return";
                  const isBackspace = obj?.key === "backspace";
                  const isShiftKey = obj?.key === "shift";

                  const flex = isSpace ? 5 : isReturn ? 2.2 : isBackspace || isShiftKey ? 1.6 : obj ? 1.4 : 1;

                  const shiftKeyBg = shiftActive ? "var(--accent-color)" : "var(--kb-key)";
                  const shiftKeyFg = shiftActive ? "var(--accent-contrast-color)" : "var(--kb-text)";

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleKey(k)}
                      style={{
                        flex,
                        minWidth: 0,
                        height: 50,
                        borderRadius: 12,
                        background: isShiftKey
                          ? shiftKeyBg
                          : obj?.key === "return"
                          ? "var(--kb-key-return)"
                          : obj?.key === "toNumbers" || obj?.key === "toSymbols" || obj?.key === "toABC"
                          ? "var(--kb-key-alt)"
                          : "var(--kb-key)",
                        border: "1px solid var(--kb-border)",
                        color: isShiftKey ? shiftKeyFg : "var(--kb-text)",
                        fontSize: 18,
                        fontWeight: 700,
                        fontFamily: "var(--coptic-font-family)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        userSelect: "none",
                        padding: "0 6px",
                        position: "relative",
                      }}
                    >
                      {isBackspace ? (
                        <IconBackspace />
                      ) : isShiftKey ? (
                        <>
                          <IconShift />
                          {capsLock ? (
                            <span
                              style={{
                                position: "absolute",
                                bottom: 8,
                                width: 18,
                                height: 3,
                                borderRadius: 3,
                                background: "var(--accent-contrast-color)",
                                opacity: 0.9,
                              }}
                            />
                          ) : null}
                        </>
                      ) : isReturn ? (
                        <AppIcon name="return" />
                      ) : isSpace ? (
                        ""
                      ) : (
                        <span className="coptic-text">{displayKey(k)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
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
