export const THEME_STORAGE_KEY = "theme-mode";

export function readThemeMode(saved) {
  return saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
}

export function resolveTheme(mode, systemPrefersDark) {
  return mode === "system" ? (systemPrefersDark ? "dark" : "light") : mode;
}

export function createThemeInitScript() {
  return `(() => {
    try {
      const key = "${THEME_STORAGE_KEY}";
      const saved = localStorage.getItem(key);
      const preference = saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
      const resolved = preference === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : preference;
      document.documentElement.dataset.theme = resolved;
    } catch {
      document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  })();`;
}
