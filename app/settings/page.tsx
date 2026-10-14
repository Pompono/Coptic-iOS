"use client";
import PageHeader from "../PageHeader";

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

  return <main className="app-page settings-page" style={{display:'grid',alignContent:'start'}}>
    <PageHeader title="Settings" description="Make Coptic feel right for you." icon="settings"/>
    <section><h2 className="settings-section-title">Appearance</h2><div className="settings-group">
      <div className="settings-row" aria-label="Theme toggle"><label htmlFor="theme-choice">App theme</label><select id="theme-choice" aria-label="App theme" value={themeMode} onChange={e=>onToggleTheme(e.target.value as ThemeMode)}><option value="light">Light</option><option value="dark">Dark</option></select></div>
      <div className="settings-row"><label htmlFor="font-choice">Coptic font</label><select id="font-choice" value={fontMode} onChange={e=>onToggleFont(e.target.value as CopticFontMode)}><option value="unicode">Standard</option><option value="avva">Avva Shenouda</option></select></div>
    </div></section>
    <section><h2 className="settings-section-title">Language</h2><div className="settings-group"><div className="settings-row"><label htmlFor="bohairic-switch">Bohairic-only mode</label><input id="bohairic-switch" type="checkbox" className="ui-switch" role="switch" checked={bohairicOnlyEnabled} onChange={e=>onToggleBohairicOnlyEnabled(e.target.checked)}/></div></div><p className="settings-note">Use verified Bohairic entries and keep the translator in Bohairic.</p></section>
    <section><h2 className="settings-section-title">Developer</h2><div className="settings-group"><div className="settings-row" aria-label="Developer tools toggle"><label htmlFor="developer-switch">Developer tools</label><input id="developer-switch" type="checkbox" className="ui-switch" role="switch" checked={devToolsEnabled} onChange={e=>onToggleDevTools(e.target.checked)}/></div></div>
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
    <section><h2 className="settings-section-title">Coptic keyboard</h2><div className="settings-group keyboard-resource"><span>Type with the iOS<br/>Coptic keyboard</span><a href={COPTIC_KEYBOARD_APP_STORE_URL} target="_blank" rel="noreferrer" aria-label="Download the Coptic Keyboard app on the App Store"><Image src="/download-on-the-app-store-badge.svg" alt="Download on the App Store" width={130} height={44}/></a></div><p className="settings-note">An optional system keyboard, available separately on the App Store.</p></section>
  </main>;
}
