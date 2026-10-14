"use client";

// Retained for compatibility with older saved preferences. The built-in keyboard
// is retired; native and installed system keyboards remain available.
export const COPTIC_KEYBOARD_ENABLED_STORAGE_KEY = "coptic-keyboard-enabled";
export const COPTIC_KEYBOARD_SESSION_VISIBLE_STORAGE_KEY = "coptic-keyboard-visible-session";

export function isCopticKeyboardEnabled(): boolean { return false; }
export function readCopticKeyboardSessionVisibility(_defaultVisible = false): boolean { return false; }
export function writeCopticKeyboardSessionVisibility(_visible: boolean) {}
