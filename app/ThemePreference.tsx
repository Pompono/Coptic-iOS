"use client";

import { syncNativeAppIcon } from "@/lib/nativeAppIcon";
import { useEffect } from "react";
import { subscribeToMediaQueryChange } from "@/lib/mediaQuery";

export const THEME_STORAGE_KEY = "theme-mode";
export type ThemeMode = "dark" | "light";

export function applyThemeMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  void syncNativeAppIcon(mode).catch(error => console.warn("App icon could not follow theme:", error));
}

function getPreferredTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "dark" || saved === "light") {
    return saved;
  }

  return "light";
}

export const themeInitScript = `(() => {
  try {
    const key = "${THEME_STORAGE_KEY}";
    const saved = localStorage.getItem(key);
    const mode = saved === "dark" || saved === "light"
      ? saved
      : "light";
    document.documentElement.dataset.theme = mode;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();`;

export default function ThemePreference() {
  useEffect(() => {
    const mode = getPreferredTheme();
    applyThemeMode(mode);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = () => {
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        applyThemeMode("light");
      }
    };

    const unsubscribe = subscribeToMediaQueryChange(media, onSystemThemeChange);
    const onResume = () => {
      if (document.visibilityState === "visible") applyThemeMode(getPreferredTheme());
    };
    document.addEventListener("visibilitychange", onResume);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  return null;
}
