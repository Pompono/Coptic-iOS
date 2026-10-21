"use client";

import { useEffect } from "react";
import { COPTIC_FONT_STORAGE_KEY, readCopticFontMode } from "@/lib/copticFontPreference.mjs";
export { COPTIC_FONT_OPTIONS, COPTIC_FONT_STORAGE_KEY, readCopticFontMode } from "@/lib/copticFontPreference.mjs";

export type CopticFontMode = "unicode" | "avva";

export function applyCopticFontMode(mode: CopticFontMode) {
  document.documentElement.dataset.copticFont = mode;
}

export default function CopticFontPreference() {
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(COPTIC_FONT_STORAGE_KEY); } catch { /* Keep Settings accessible when storage is unavailable. */ }
    const mode = readCopticFontMode(saved);
    applyCopticFontMode(mode);
  }, []);

  return null;
}
