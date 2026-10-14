"use client";

import {usePathname} from 'next/navigation';
import { useEffect, useState } from "react";
import { audioService } from "@/lib/audioService";

export default function AudioUnlock() {
  const pathname=usePathname();
  useEffect(()=>()=>audioService.stopAll(),[pathname]);
  const [audioError, setAudioError] = useState("");
  useEffect(() => {
    const onFailure = (event: Event) => setAudioError((event as CustomEvent<string>).detail);
    const onPlayed = () => setAudioError("");
    window.addEventListener("coptic-audio-error", onFailure);
    window.addEventListener("coptic-audio-played", onPlayed);
    return () => {
      window.removeEventListener("coptic-audio-error", onFailure);
      window.removeEventListener("coptic-audio-played", onPlayed);
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let removed = false;

    const removeListeners = () => {
      if (removed) {
        return;
      }

      removed = true;
      window.removeEventListener("pointerdown", handleUnlock);
      window.removeEventListener("touchstart", handleUnlock);
      window.removeEventListener("click", handleUnlock);
      window.removeEventListener("keydown", handleUnlock);
    };

    const handleUnlock = () => {
      void audioService.unlock().then(removeListeners).catch(() => {
        // Keep listeners in place so the next gesture can retry.
      });
    };

    window.addEventListener("pointerdown", handleUnlock, { passive: true });
    window.addEventListener("touchstart", handleUnlock, { passive: true });
    window.addEventListener("click", handleUnlock, { passive: true });
    window.addEventListener("keydown", handleUnlock);

    const pauseAudio = () => {
      void audioService.pause().catch(() => {});
      window.speechSynthesis?.cancel();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") pauseAudio();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", pauseAudio);

    return () => {
      removeListeners();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", pauseAudio);
    };
  }, []);

  return audioError ? <div role="alert" className="audio-error-notice">
    <p>{audioError}</p><button onClick={() => setAudioError("")}>Dismiss</button>
  </div> : null;
}
