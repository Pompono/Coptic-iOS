"use client";

import { COPTIC_KEYBOARD_APP_STORE_URL } from "../KeyboardInstallPrompt";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearAllUnitProgress } from "../learn/progress";
import { lessons } from "@/lib/lesson";
import {
  applyCopticFontMode,
  COPTIC_FONT_STORAGE_KEY,
  type CopticFontMode,
} from "../CopticFontPreference";
import {
  COPTIC_KEYBOARD_ENABLED_STORAGE_KEY,
  isCopticKeyboardEnabled,
} from "../CopticKeyboardPreference";
import { applyThemeMode, THEME_STORAGE_KEY, type ThemeMode } from "../ThemePreference";
import {
  BOHAIRIC_ONLY_STORAGE_KEY,
  isBohairicOnlyEnabled,
} from "../BohairicPreference";
import { clearProgress } from "@/lib/progress";
import { subscribeToMediaQueryChange } from "@/lib/mediaQuery";


export default function SettingsPage() {
  const router = useRouter();
  const [fontMode, setFontMode] = useState<CopticFontMode>("avva");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [keyboardEnabled, setKeyboardEnabled] = useState(false);
  const [bohairicOnlyEnabled, setBohairicOnlyEnabled] = useState(true);
  const [devToolsEnabled, setDevToolsEnabled] = useState(false);
  const [devLessonId, setDevLessonId] = useState(lessons[0]?.id ?? "");
  const [devStepId, setDevStepId] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isNarrowLayout, setIsNarrowLayout] = useState(false);

  useEffect(() => {
    const savedFont = localStorage.getItem(COPTIC_FONT_STORAGE_KEY);
    const font: CopticFontMode = savedFont === "unicode" ? "unicode" : "avva";
    setFontMode(font);
    applyCopticFontMode(font);

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const theme: ThemeMode = savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";

    setThemeMode(theme);
    applyThemeMode(theme);

    setKeyboardEnabled(isCopticKeyboardEnabled());
    setBohairicOnlyEnabled(isBohairicOnlyEnabled());
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 430px)");
    const syncNarrowLayout = () => setIsNarrowLayout(mediaQuery.matches);

    syncNarrowLayout();
    return subscribeToMediaQueryChange(mediaQuery, syncNarrowLayout);
  }, []);

  const selectedLesson = lessons.find((lesson) => lesson.id === devLessonId) ?? lessons[0] ?? null;
  const selectedLessonSteps =
    selectedLesson?.progressionGroups?.flatMap((group) => group.lessons).filter((step) => Boolean(step.exerciseSet)) ??
    [];

  useEffect(() => {
    if (!selectedLesson) {
      return;
    }

    if (selectedLesson.id !== devLessonId) {
      setDevLessonId(selectedLesson.id);
      return;
    }

    const hasSelectedStep = selectedLessonSteps.some((step) => step.id === devStepId);
    if (!hasSelectedStep) {
      setDevStepId(selectedLessonSteps[0]?.id ?? "");
    }
  }, [devLessonId, devStepId, selectedLesson, selectedLessonSteps]);

  const onToggleFont = (nextMode: CopticFontMode) => {
    setFontMode(nextMode);
    localStorage.setItem(COPTIC_FONT_STORAGE_KEY, nextMode);
    applyCopticFontMode(nextMode);
  };

  const onToggleTheme = (nextMode: ThemeMode) => {
    setThemeMode(nextMode);
    localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    applyThemeMode(nextMode);
  };

  const onToggleKeyboardEnabled = (nextEnabled: boolean) => {
    setKeyboardEnabled(nextEnabled);
    localStorage.setItem(COPTIC_KEYBOARD_ENABLED_STORAGE_KEY, String(nextEnabled));
  };

  const onToggleBohairicOnlyEnabled = (nextEnabled: boolean) => {
    setBohairicOnlyEnabled(nextEnabled);
    localStorage.setItem(BOHAIRIC_ONLY_STORAGE_KEY, String(nextEnabled));
  };

  const onToggleDevTools = (nextEnabled: boolean) => {
    setDevToolsEnabled(nextEnabled);
    if (!nextEnabled) {
      setResetMessage("");
    }
  };

  const onResetProgress = () => {
    const confirmed = window.confirm("Reset all lesson progress, XP, and streak data on this device?");
    if (!confirmed) {
      return;
    }

    clearProgress();
    clearAllUnitProgress();
    setResetMessage("All local learning progress has been reset.");
  };

  const onOpenLearnMap = () => {
    router.push("/learn");
  };

  const onOpenLesson = () => {
    if (!selectedLesson) {
      return;
    }

    router.push(`/learn/${selectedLesson.id}`);
  };

  const onOpenStep = () => {
    if (!selectedLesson || !devStepId) {
      return;
    }

    router.push(`/learn/${selectedLesson.id}/play/${devStepId}`);
  };

  const toggleButtonStyle = (active: boolean) => ({
    minWidth: 76,
    minHeight: 44,
    padding: "8px 12px",
    border: "none",
    cursor: "pointer",
    background: active ? "var(--toggle-active-bg)" : "transparent",
    color: active ? "var(--toggle-active-text)" : "var(--text-color)",
    fontWeight: 700,
    fontSize: 13,
    lineHeight: 1.2,
    textAlign: "center" as const,
    fontFamily: "inherit",
  });

  const toggleRowStyle = {
    display: "grid",
    gridTemplateColumns: isNarrowLayout ? "1fr" : "minmax(160px, max-content) auto",
    alignItems: "center",
    columnGap: 10,
    rowGap: isNarrowLayout ? 8 : 0,
  } as const;

  const toggleLabelStyle = {
    fontSize: 14,
    fontWeight: 600,
    maxWidth: "100%",
    overflowWrap: "anywhere" as const,
  } as const;

  const toggleControlStyle = {
    display: "inline-flex",
    border: "1px solid var(--border-color)",
    borderRadius: 12,
    overflow: "hidden",
    justifySelf: "end",
  } as const;

  const devActionButtonStyle = {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid var(--border-color)",
    background: "var(--panel-bg)",
    color: "var(--text-color)",
    fontWeight: 700,
    cursor: "pointer",
  } as const;

  const devSelectStyle = {
    minWidth: isNarrowLayout ? "100%" : 280,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--border-color)",
    background: "var(--panel-bg)",
    color: "var(--text-color)",
    fontFamily: "inherit",
    fontSize: 14,
  } as const;

  return (
    <main className="app-page settings-page"
      style={{
        maxWidth: 900,
        margin: "0 auto",
        minHeight: "var(--page-content-height)",
        display: "grid",
        alignContent: "start",
        gap: 20,
      }}
    >
      <div className="app-page-header">
        <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 34, fontWeight: 800 }}>Settings</h1>
        <p style={{ marginBottom: 0, opacity: 0.85 }}>Make Coptic feel right for you.</p>
      </div>

      <section className="settings-panel"
        style={{
          display: "grid",
          gap: 20,
          border: "1px solid var(--border-color)",
          borderRadius: 20,
          padding: 20,
          background: "var(--panel-bg)",
        }}
      >
        <div style={toggleRowStyle} aria-label="Theme toggle">
          <span style={toggleLabelStyle}>App Theme</span>
          <div style={toggleControlStyle}>
            <button type="button" onClick={() => onToggleTheme("light")} aria-pressed={themeMode === "light"} style={toggleButtonStyle(themeMode === "light")}>
              Light
            </button>
            <button type="button" onClick={() => onToggleTheme("dark")} aria-pressed={themeMode === "dark"} style={toggleButtonStyle(themeMode === "dark")}>
              Dark
            </button>
          </div>
        </div>

        <div style={toggleRowStyle} aria-label="Coptic font toggle">
          <span style={toggleLabelStyle}>Coptic Font</span>

          <div style={toggleControlStyle}>
            <button type="button" onClick={() => onToggleFont("unicode")} aria-pressed={fontMode === "unicode"} style={toggleButtonStyle(fontMode === "unicode")}>
              Standard
            </button>
            <button type="button" onClick={() => onToggleFont("avva")} aria-pressed={fontMode === "avva"} style={toggleButtonStyle(fontMode === "avva")}>
              New
            </button>
          </div>
        </div>

        <div style={toggleRowStyle} aria-label="Bohairic-only mode toggle">
          <span style={toggleLabelStyle}>Global Bohairic-only Mode</span>

          <div style={toggleControlStyle}>
            <button
              type="button"
              onClick={() => onToggleBohairicOnlyEnabled(false)}
              aria-pressed={!bohairicOnlyEnabled} style={toggleButtonStyle(!bohairicOnlyEnabled)}
            >
              Off
            </button>
            <button
              type="button"
              onClick={() => onToggleBohairicOnlyEnabled(true)}
              aria-pressed={bohairicOnlyEnabled} style={toggleButtonStyle(bohairicOnlyEnabled)}
            >
              On
            </button>
          </div>
        </div>

        <div style={toggleRowStyle} aria-label="On-screen Coptic keyboard toggle">
          <span style={toggleLabelStyle}>On-screen Coptic Keyboard</span>

          <div style={toggleControlStyle}>
            <button
              type="button"
              onClick={() => onToggleKeyboardEnabled(false)}
              aria-pressed={!keyboardEnabled} style={toggleButtonStyle(!keyboardEnabled)}
            >
              Disabled
            </button>
            <button
              type="button"
              onClick={() => onToggleKeyboardEnabled(true)}
              aria-pressed={keyboardEnabled} style={toggleButtonStyle(keyboardEnabled)}
            >
              Enabled
            </button>
          </div>
        </div>

        <div style={toggleRowStyle} aria-label="Developer tools toggle">
          <span style={toggleLabelStyle}>Developer Tools</span>

          <div style={toggleControlStyle}>
            <button
              type="button"
              onClick={() => onToggleDevTools(false)}
              aria-pressed={!devToolsEnabled} style={toggleButtonStyle(!devToolsEnabled)}
            >
              Off
            </button>
            <button
              type="button"
              onClick={() => onToggleDevTools(true)}
              aria-pressed={devToolsEnabled} style={toggleButtonStyle(devToolsEnabled)}
            >
              On
            </button>
          </div>
        </div>

        {devToolsEnabled ? (
          <div
            style={{
              borderTop: "1px solid var(--border-color)",
              paddingTop: 18,
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Reset all progress</div>
              <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.8 }}>
                Clears lesson completion, XP, and streak data stored in this browser.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <button
                type="button"
                onClick={onResetProgress}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #c85e5e",
                  background: "#b23a3a",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Reset Progress
              </button>

              {resetMessage ? (
                <span style={{ fontSize: 13, color: "var(--text-color)", opacity: 0.82 }}>{resetMessage}</span>
              ) : null}
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Jump around</div>
              <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.8 }}>
                Open the learn map, a unit page, or a playable lesson step directly.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <button type="button" onClick={onOpenLearnMap} style={devActionButtonStyle}>
                Open Learn Map
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <select
                aria-label="Select lesson"
                value={selectedLesson?.id ?? ""}
                onChange={(event) => setDevLessonId(event.target.value)}
                style={devSelectStyle}
              >
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.sectionTitle} - Unit {lesson.unitNumber}: {lesson.title.replace(/^Unit \d+: /, "")}
                  </option>
                ))}
              </select>

              <button type="button" onClick={onOpenLesson} style={devActionButtonStyle} disabled={!selectedLesson}>
                Open Unit
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <select
                aria-label="Select lesson step"
                value={devStepId}
                onChange={(event) => setDevStepId(event.target.value)}
                style={devSelectStyle}
                disabled={selectedLessonSteps.length === 0}
              >
                {selectedLessonSteps.length > 0 ? (
                  selectedLessonSteps.map((step) => (
                    <option key={step.id} value={step.id}>
                      {step.title}: {step.summary}
                    </option>
                  ))
                ) : (
                  <option value="">No playable steps yet</option>
                )}
              </select>

              <button
                type="button"
                onClick={onOpenStep}
                style={devActionButtonStyle}
                disabled={!selectedLesson || !devStepId}
              >
                Open Step
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 10,
          paddingTop: 4,
        }}
      >
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8, textAlign: "center" }}>
          Prefer the system Coptic keyboard?
        </p>
        <a
          href={COPTIC_KEYBOARD_APP_STORE_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Download the Coptic Keyboard app on the App Store"
          style={{ display: "inline-flex", lineHeight: 0 }}
        >
          <Image
            src="/download-on-the-app-store-badge.svg"
            alt="Download on the App Store"
            width={180}
            height={60}
            style={{ width: 180, height: "auto", display: "block" }}
          />
        </a>
      </div>
    </main>
  );
}
