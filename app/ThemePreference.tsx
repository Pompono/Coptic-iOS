"use client";

import { syncNativeAppIcon } from "@/lib/nativeAppIcon";
import { setNativeWebViewBackground } from "@/lib/nativeExperience";
import { createThemeInitScript, readThemeMode, resolveTheme as resolveThemePreference, THEME_STORAGE_KEY } from "@/lib/themePreference.mjs";
import { useEffect } from "react";
import { subscribeToMediaQueryChange } from "@/lib/mediaQuery";

export { THEME_STORAGE_KEY };
export type ThemeMode = "system" | "dark" | "light";
type ResolvedTheme = Exclude<ThemeMode, "system">;

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return resolveThemePreference(mode, window.matchMedia("(prefers-color-scheme: dark)").matches) as ResolvedTheme;
}

export function applyThemeMode(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  const channels = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/gu)?.slice(0, 3).map(Number);
  if (channels?.length === 3) void setNativeWebViewBackground(channels[0] / 255, channels[1] / 255, channels[2] / 255);
  void syncNativeAppIcon(resolved).catch(error => console.warn("App icon could not follow theme:", error));
}

export function readThemePreference(): ThemeMode {
  try {
    return readThemeMode(localStorage.getItem(THEME_STORAGE_KEY)) as ThemeMode;
  } catch {
    return "system";
  }
}

export const themeInitScript = createThemeInitScript();

export default function ThemePreference() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => applyThemeMode(readThemePreference());
    syncTheme();

    const unsubscribe = subscribeToMediaQueryChange(media, () => {
      if (readThemePreference() === "system") syncTheme();
    });
    const onResume = () => {
      if (document.visibilityState === "visible") syncTheme();
    };
    document.addEventListener("visibilitychange", onResume);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  return null;
}
