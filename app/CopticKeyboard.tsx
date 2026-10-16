"use client";

import AppIcon from "./AppIcon";

export type CopticSpecialKey =
  | "backspace"
  | "shift"
  | "space"
  | "return"
  | "toABC"
  | "toNumbers"
  | "toSymbols";

export type CopticKey = string | { key: CopticSpecialKey; label?: string };
export type CopticKeyboardMode = "ABC" | "NUMBERS" | "SYMBOLS";
export type CopticShiftMode = "off" | "once" | "lock";

import {
  applyCopticCase,
  COPTIC_CASE_MAP,
  COPTIC_KEYBOARD_LAYOUTS,
  editTextAtSelection,
  isCopticKey,
  removePreviousGrapheme,
} from "../lib/copticKeyboard.mjs";

export { applyCopticCase, COPTIC_CASE_MAP, COPTIC_KEYBOARD_LAYOUTS, editTextAtSelection, isCopticKey, removePreviousGrapheme };

export function isCopticSpecialKey(key: CopticKey): key is Exclude<CopticKey, string> {
  return typeof key !== "string";
}

export function updateInputAtSelection(
  input: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  insertedText: string | null,
  onValueChange: (nextValue: string) => void,
) {
  const start = input?.selectionStart ?? value.length;
  const end = input?.selectionEnd ?? value.length;
  const edited = editTextAtSelection(value, start, end, insertedText);
  onValueChange(edited.value);
  if (input) requestAnimationFrame(() => input.setSelectionRange(edited.selection, edited.selection));
}

function IconBackspace() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 5H11c-.6 0-1.1.3-1.5.8L4 12l5.5 6.2c.4.5.9.8 1.5.8h9c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2Zm-2.6 10.2-1.2 1.2L14 14.2l-2.2 2.2-1.2-1.2L12.8 13l-2.2-2.2 1.2-1.2L14 11.8l2.2-2.2 1.2 1.2L15.2 13l2.2 2.2Z" /></svg>;
}

function IconShift() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3 4 11h5v6h6v-6h5L12 3Zm1 12H11v-6H9.5L12 6.5 14.5 9H13v6Z" /></svg>;
}

export function CopticKeyboardGrid({
  page,
  handleKey,
  displayKey,
  shiftMode,
  mobile = false,
}: {
  page: readonly (readonly CopticKey[])[];
  handleKey: (key: CopticKey) => void;
  displayKey: (key: CopticKey) => string;
  shiftMode: CopticShiftMode;
  mobile?: boolean;
}) {
  const shiftActive = shiftMode !== "off";

  return <div style={{ padding: 12, borderRadius: mobile ? 14 : 16, background: "var(--kb-panel)", border: "1px solid var(--kb-border)" }}>
    {page.map((row, rowIndex) => <div key={rowIndex} style={{ display: "flex", gap: mobile ? 6 : 8, justifyContent: "center", marginBottom: rowIndex === page.length - 1 ? 0 : mobile ? 8 : 10 }}>
      {row.map((key, keyIndex) => {
        const special = isCopticSpecialKey(key) ? key : null;
        const isSpace = special?.key === "space";
        const isReturn = special?.key === "return";
        const isBackspace = special?.key === "backspace";
        const isShift = special?.key === "shift";
        const flex = isSpace ? 5 : isReturn ? 2.2 : isBackspace || isShift ? 1.6 : special ? 1.4 : 1;
        const alternate = special?.key === "toNumbers" || special?.key === "toSymbols" || special?.key === "toABC";
        return <button
          key={keyIndex}
          type="button"
          aria-label={isBackspace ? "Delete previous character" : isShift ? "Change letter case" : isSpace ? "Space" : isReturn ? "Translate" : undefined}
          onClick={() => handleKey(key)}
          style={{
            flex, minWidth: mobile ? 0 : 44, height: mobile ? 50 : 56,
            borderRadius: mobile ? 12 : 14,
            background: isShift && shiftActive ? "var(--accent-color)" : isReturn ? "var(--kb-key-return)" : alternate ? "var(--kb-key-alt)" : "var(--kb-key)",
            border: "1px solid var(--kb-border)",
            color: isShift && shiftActive ? "var(--accent-contrast-color)" : "var(--kb-text)",
            fontSize: mobile ? 18 : 20, fontWeight: 700, fontFamily: "var(--coptic-font-family)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            userSelect: "none", padding: mobile ? "0 6px" : "0 10px", position: "relative",
          }}
        >
          {isBackspace ? <IconBackspace /> : isShift ? <><IconShift />{shiftMode === "lock" ? <span style={{ position: "absolute", bottom: 8, width: 18, height: 3, borderRadius: 3, background: "var(--accent-contrast-color)", opacity: 0.9 }} /> : null}</> : isReturn ? <AppIcon name="return" /> : isSpace ? "" : <span className="coptic-text">{displayKey(key)}</span>}
        </button>;
      })}
    </div>)}
  </div>;
}
