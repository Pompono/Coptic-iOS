"use client";

import { useEffect } from "react";

export const COPTIC_FONT_STORAGE_KEY = "coptic-font-mode";
export type CopticFontMode = "unicode" | "avva";

export function applyCopticFontMode(mode: CopticFontMode) {
  document.documentElement.dataset.copticFont = mode;
}

export default function CopticFontPreference() {
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(COPTIC_FONT_STORAGE_KEY); } catch { /* Keep Settings accessible when storage is unavailable. */ }
    const mode: CopticFontMode = saved === "unicode" ? "unicode" : "avva";
    applyCopticFontMode(mode);
  }, []);

  return null;
}
