"use client";

import { Capacitor } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const DISMISSED_KEY = "coptic-ios-keyboard-prompt-dismissed";
export const COPTIC_KEYBOARD_APP_STORE_URL = "https://apps.apple.com/us/app/coptic-keyboard/id1510907422";

export default function KeyboardInstallPrompt() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ios = Capacitor.getPlatform() === "ios" || /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!ios) return;
    try { if (localStorage.getItem(DISMISSED_KEY) === "true") return; } catch {}
    setOpen(true);
  }, []);

  const dismissPermanently = () => {
    try { localStorage.setItem(DISMISSED_KEY, "true"); } catch {}
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button, a[href], input') ?? []);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return <div className="keyboard-prompt-backdrop">
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="keyboard-prompt-title" aria-describedby="keyboard-prompt-description" className="keyboard-prompt">
      <button ref={close} className="keyboard-prompt-close" onClick={() => setOpen(false)} aria-label="Close keyboard prompt">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
      <h2 id="keyboard-prompt-title">Type Coptic on your iPhone</h2>
      <p id="keyboard-prompt-description">Install the Coptic Keyboard to type in Coptic throughout the app.</p>
      <p className="keyboard-prompt-note">After installing, add it in iOS Settings → General → Keyboard → Keyboards → Add New Keyboard.</p>
      <a href={COPTIC_KEYBOARD_APP_STORE_URL} target="_blank" rel="noreferrer" aria-label="Download the Coptic Keyboard app on the App Store" className="keyboard-prompt-store">
        <Image src="/download-on-the-app-store-badge.svg" alt="Download on the App Store" width={180} height={60} />
      </a>
      <label className="keyboard-prompt-dismiss"><input type="checkbox" onChange={event => { if (event.target.checked) dismissPermanently(); }} /> Don’t show again</label>
      <button className="keyboard-prompt-installed" onClick={dismissPermanently}>Already installed</button>
    </div>
  </div>;
}
