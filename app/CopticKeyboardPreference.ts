"use client";

export const COPTIC_KEYBOARD_ENABLED_STORAGE_KEY = "coptic-keyboard-enabled";
export const COPTIC_KEYBOARD_SESSION_VISIBLE_STORAGE_KEY = "coptic-keyboard-visible-session";

export function isCopticKeyboardEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = localStorage.getItem(COPTIC_KEYBOARD_ENABLED_STORAGE_KEY);
  if (stored !== null) return stored !== "false";
  return !window.matchMedia("(max-width: 768px)").matches;
}

export function readCopticKeyboardSessionVisibility(defaultVisible = true): boolean {
  if (typeof window === "undefined") {
    return defaultVisible;
  }

  const stored = window.sessionStorage.getItem(COPTIC_KEYBOARD_SESSION_VISIBLE_STORAGE_KEY);
  if (stored === null) {
    return defaultVisible;
  }

  return stored !== "false";
}

export function writeCopticKeyboardSessionVisibility(visible: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(COPTIC_KEYBOARD_SESSION_VISIBLE_STORAGE_KEY, visible ? "true" : "false");
}
