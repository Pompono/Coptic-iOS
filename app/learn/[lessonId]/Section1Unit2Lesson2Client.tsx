"use client";
import {RecordingCard} from "@/app/AudioReplay";

import { COPTIC, QUESTIONS, type LessonQuestion } from "@/lib/learning/wordLesson2";
import { LearningSession, LessonExplanation, useLearningSession } from "../learning/LearningSession";
import { itemsForQuestion } from "@/lib/learning/content";
import { LESSON_THEME } from "@/lib/lessonTheme";

import Image from "next/image";
import Link from "@/lib/AppLink";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { audioService, reportAudioFailure } from "@/lib/audioService";
import { resolveLessonAudio } from "../../../lib/lessonAudio";
import { clearStepFailed, markStepCompleted, markStepFailed } from "../progress";
import { type Lesson, type UnitLessonStep } from "../../../lib/lesson";

const SUCCESS_MESSAGES = ["Awesome!", "Excellent!", "Nice!", "Well done!", "Perfect!"] as const;



function containsCoptic(text: string) {
  return /[\u2C80-\u2CFF\u03E2-\u03EF]/.test(text);
}

function normalizeAnswer(input: string) {
  return input.normalize("NFKC").trim().replace(/[.!?,:;]+$/u, "").replace(/\s+/g, " ").toLowerCase();
}


function playLessonAudio(lessonId: string, audioId: string, fallbackText: string) {
  const entry = resolveLessonAudio(lessonId, audioId);
  const spokenFallback = entry?.fallbackText ?? fallbackText;
  const fallbackDurationMs = Math.max(900, spokenFallback.trim().split(/\s+/).filter(Boolean).length * 420);

  if (typeof window === "undefined") {
    return Promise.resolve(fallbackDurationMs);
  }

  if (entry?.src) {
    return audioService
      .play(entry.src, entry.src)
      .then((source) => Math.max(fallbackDurationMs, Math.round((source.buffer?.duration ?? 0) * 1000)))
      .catch(error => {
        reportAudioFailure(error);
        return fallbackDurationMs;
      });
  }

  reportAudioFailure(new Error(`No bundled recording is available for "${audioId}".`));
  return Promise.resolve(fallbackDurationMs);
}

function getQuestionAudioId(question: LessonQuestion) {
  return question.audioId;
}

function getQuestionDisplay(question: LessonQuestion) {
  switch (question.kind) {
    case "sound_mcq":
      return question.answer;
    case "letter_mcq":
      return question.sound;
    case "listening_mcq":
      return question.audio;
    case "word_bank":
      return question.text;
  }
}

function getExpectedAnswer(question: LessonQuestion) {
  return question.answer;
}

function getTranslateGlossary(question: LessonQuestion) {
  if (question.kind !== "listening_mcq" || question.prompt !== "Translate this phrase") {
    return null;
  }

  switch (question.id) {
    case "u2l2-10":
      return {
        label: COPTIC.anna,
        translations: ["Anna", "Ann"],
      };
    case "u2l2-11":
      return {
        label: COPTIC.seAnna,
        translations: ["yes Anna", "yeah Anna"],
      };
    case "u2l2-12":
      return {
        label: COPTIC.seMaria,
        translations: ["yes Maria", "Maria"],
      };
    default:
      return null;
  }
}



function IconClose({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="m18.3 5.7-1.4-1.4L12 9.2 7.1 4.3 5.7 5.7 10.6 10.6 5.7 15.5l1.4 1.4 4.9-4.9 4.9 4.9 1.4-1.4-4.9-4.9 4.9-4.9Z"
      />
    </svg>
  );
}

function IconSparkle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.5c.4 0 .8.3.9.7l1.2 4.5a1 1 0 0 0 .7.7l4.5 1.2c.4.1.7.5.7.9s-.3.8-.7.9l-4.5 1.2a1 1 0 0 0-.7.7l-1.2 4.5c-.1.4-.5.7-.9.7s-.8-.3-.9-.7l-1.2-4.5a1 1 0 0 0-.7-.7l-4.5-1.2c-.4-.1-.7-.5-.7-.9s.3-.8.7-.9l4.5-1.2a1 1 0 0 0 .7-.7l1.2-4.5c.1-.4.5-.7.9-.7Z"
      />
    </svg>
  );
}

function IconChevronDown({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.7 9.2a1 1 0 0 1 1.4.1l3.9 4.5 3.9-4.5a1 1 0 1 1 1.5 1.3l-4.7 5.4a1 1 0 0 1-1.5 0l-4.7-5.4a1 1 0 0 1 .1-1.4Z"
      />
    </svg>
  );
}

function LessonOutcomeCelebration({
  kicker,
  message,
  subtitle,
  icon,
}: {
  kicker: string;
  message: string;
  subtitle: string;
  icon: "check" | "cross";
}) {
  const outcomeRingBorder = "var(--border-color)";
  const outcomeOuterBackground = "var(--surface-1)";
  const outcomeInnerBorder = "var(--border-color)";
  const outcomeCoreBackground = "var(--teal-surface)";
  const outcomeCoreShadow = "none";
  const outcomeKickerColor = "var(--text-muted)";
  const outcomeSubtitleColor = "var(--text-muted)";

  return (
    <>
      <main className={`lesson-outcome-screen ${icon === "cross" ? "is-failure" : ""}`}>
        <div className="lesson-outcome-shell">
          <div className="lesson-outcome-stage" aria-hidden="true">
            <div className="lesson-outcome-badge">
              <div className="lesson-outcome-ring lesson-outcome-ring-outer" />
              <div className="lesson-outcome-ring lesson-outcome-ring-inner" />
              <div className="lesson-outcome-core">
                <span className="lesson-outcome-icon" aria-hidden="true">
                  {icon === "check" ? (
                    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                      <path
                        d="M14 27.5 22.5 36 38 18"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                      <path
                        d="M17 17 35 35"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M35 17 17 35"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="lesson-outcome-kicker">{kicker}</div>
          <h1 className="lesson-outcome-message">{message}</h1>
          <p className="lesson-outcome-subtitle">{subtitle}</p>
        </div>
      </main>

      <style jsx global>{`
        .lesson-outcome-screen {
          min-height: var(--page-content-height);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 28px 18px 42px;
          background:
            radial-gradient(circle at top, rgba(255, 255, 255, 0.22), transparent 34%),
            radial-gradient(circle at 50% 42%, rgba(43, 65, 96, 0.06), transparent 30%),
            linear-gradient(180deg, ${LESSON_THEME.bgTop} 0%, ${LESSON_THEME.bgBottom} 100%);
          color: ${LESSON_THEME.textPrimary};
          overflow: hidden;
          animation: lesson-outcome-screen-fade 1900ms ease forwards;
        }

        .lesson-outcome-shell {
          width: min(100%, 460px);
          display: grid;
          justify-items: center;
          gap: 18px;
          animation: lesson-outcome-shell-rise 1900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .lesson-outcome-stage {
          position: relative;
          width: 220px;
          height: 220px;
          display: grid;
          place-items: center;
        }

        .lesson-outcome-badge {
          position: relative;
          width: 172px;
          height: 172px;
          display: grid;
          place-items: center;
          animation: lesson-outcome-badge-settle 1900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .lesson-outcome-ring {
          position: absolute;
          border-radius: 999px;
          border: 2px solid var(--lesson-outcome-ring-border, ${outcomeRingBorder});
        }

        .lesson-outcome-ring-outer {
          inset: 0;
          background: var(--lesson-outcome-outer, ${outcomeOuterBackground});
          box-shadow: 0 18px 36px rgba(43, 65, 96, 0.1);
        }

        .lesson-outcome-ring-inner {
          inset: 14px;
          border: 10px solid var(--lesson-outcome-inner-border, ${outcomeInnerBorder});
        }

        .lesson-outcome-core {
          position: absolute;
          inset: 38px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: ${outcomeCoreBackground};
          box-shadow: ${outcomeCoreShadow};
        }

        .lesson-outcome-icon {
          color: #f1ebde;
        }

        .lesson-outcome-icon svg {
          display: block;
        }

        .lesson-outcome-kicker {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--lesson-outcome-muted, ${outcomeKickerColor});
        }

        .lesson-outcome-message {
          margin: 0;
          font-size: clamp(36px, 10vw, 60px);
          line-height: 0.98;
          font-weight: 800;
          letter-spacing: -0.05em;
          text-align: center;
          color: ${LESSON_THEME.textPrimary};
          animation: lesson-outcome-message-rise 1900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .lesson-outcome-subtitle {
          margin: -2px 0 0;
          font-size: 16px;
          line-height: 1.5;
          color: var(--lesson-outcome-muted, ${outcomeSubtitleColor});
          text-align: center;
          animation: lesson-outcome-subtitle-rise 1900ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        @keyframes lesson-outcome-badge-settle {
          0%,
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          20% {
            opacity: 1;
            transform: translateY(-8px) scale(1.04);
          }
          40% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes lesson-outcome-message-rise {
          0% {
            opacity: 0;
            transform: translateY(16px);
          }
          22% {
            opacity: 1;
            transform: translateY(0);
          }
          70% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-12px);
          }
        }

        @keyframes lesson-outcome-subtitle-rise {
          0% {
            opacity: 0;
            transform: translateY(12px);
          }
          28% {
            opacity: 1;
            transform: translateY(0);
          }
          70% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-8px);
          }
        }

        @keyframes lesson-outcome-shell-rise {
          0% {
            opacity: 0;
            transform: translateY(22px);
          }
          18% {
            opacity: 1;
            transform: translateY(0);
          }
          72% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px);
          }
        }

        @keyframes lesson-outcome-screen-fade {
          0%,
          72% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @media (max-width: 640px) {
          .lesson-outcome-screen {
            padding: 24px 14px 34px;
          }

          .lesson-outcome-stage {
            width: 188px;
            height: 188px;
          }

          .lesson-outcome-badge {
            width: 152px;
            height: 152px;
          }

          .lesson-outcome-core {
            inset: 34px;
          }

          .lesson-outcome-icon svg {
            width: 46px;
            height: 46px;
          }
        }
      `}</style>
    </>
  );
}

function LessonCompleteCelebration({
  message,
}: {
  message: string;
}) {
  return (
    <LessonOutcomeCelebration
      kicker="Lesson complete"
      message={message}
      subtitle="Returning you to the unit map..."
      icon="check"
    />
  );
}

export default function Section1Unit2Lesson2Client({
  lesson,
  step,
}: {
  lesson: Lesson;
  step: UnitLessonStep;
}) {
  const learning = useLearningSession();
  const router = useRouter();
  const audioUnlockedRef = useRef(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 900 });
  const [index, setIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [bubbleSpeakerFrame, setBubbleSpeakerFrame] = useState<1 | 2 | 3>(3);
  const [resultState, setResultState] = useState<"idle" | "correct" | "wrong">("idle");
  const [successMessage, setSuccessMessage] = useState<string>(SUCCESS_MESSAGES[0]);
  const [isComplete, setIsComplete] = useState(false);
  const bubbleSpeakerIntervalRef = useRef<number | null>(null);
  const bubbleSpeakerTimeoutRef = useRef<number | null>(null);
  const bubbleSpeakerPlaybackTokenRef = useRef(0);

  const question = QUESTIONS[index];
  const questionAudioId = getQuestionAudioId(question);
  const questionDisplay = getQuestionDisplay(question);
  const expectedAnswer = getExpectedAnswer(question);

  const isPhoneViewport = viewport.width <= 480;
  const compactPhone = isPhoneViewport;
  const desktopLayout = !compactPhone;
  const ultraCompactPhone = compactPhone && viewport.height <= 760;
  const tinyPhone = compactPhone && (viewport.height <= 700 || viewport.width <= 360);
  const narrowPhone = compactPhone && viewport.width <= 380;
  const shellPadding = compactPhone
    ? tinyPhone
      ? "8px 8px 8px"
      : ultraCompactPhone
        ? "10px 10px 12px"
        : "12px 12px 14px"
    : "18px 16px 28px";
  const containerGap = compactPhone ? (tinyPhone ? 6 : ultraCompactPhone ? 10 : 12) : 18;
  const headerButtonSize = compactPhone ? 38 : 46;
  const progressHeight = compactPhone ? 12 : 16;
  const titleFontSize = compactPhone ? (tinyPhone ? 18 : ultraCompactPhone ? 20 : 24) : 34;
  const cardMinHeight = compactPhone ? (tinyPhone ? 112 : ultraCompactPhone ? 132 : 156) : 260;
  const cardRadius = compactPhone ? 24 : 34;
  const cardPadding = compactPhone ? (tinyPhone ? 12 : ultraCompactPhone ? 14 : 16) : 24;
  const gridGap = compactPhone ? (tinyPhone ? 8 : 10) : 18;
  const choiceMinHeight = compactPhone ? (tinyPhone ? 64 : ultraCompactPhone ? 82 : 92) : 122;
  const cardLabelFontSize = compactPhone ? (tinyPhone ? 48 : ultraCompactPhone ? 58 : 66) : 92;
  const baseChoiceTextFontSize = compactPhone ? (tinyPhone ? 24 : ultraCompactPhone ? 28 : 32) : 38;
  const choiceTextFontSize = narrowPhone ? Math.max(24, baseChoiceTextFontSize - 4) : baseChoiceTextFontSize;
  const actionButtonFontSize = compactPhone ? (tinyPhone ? 16 : ultraCompactPhone ? 18 : 20) : 22;
  const actionButtonPadding = compactPhone
    ? tinyPhone
      ? "12px 14px"
      : ultraCompactPhone
        ? "14px 16px"
        : "16px 18px"
    : "18px 20px";
  const resultPadding = compactPhone ? (tinyPhone ? 10 : ultraCompactPhone ? 12 : 14) : 18;
  const footerShellMinHeight = compactPhone ? 76 : 100;
  const promptRowBaseHeight = compactPhone ? (tinyPhone ? 56 : ultraCompactPhone ? 70 : 82) : 116;
  const slidePanelGap = compactPhone ? (tinyPhone ? 12 : ultraCompactPhone ? 14 : 16) : 20;
  const desktopSlideViewportHeight = 520;
  const progress = Math.max(0.08, index / QUESTIONS.length);
  const isTranslateChoiceScreen =
    question.kind === "listening_mcq" && question.prompt === "Translate this phrase";
  const translateGlossary = getTranslateGlossary(question);
  const showsNewWordBadge = isTranslateChoiceScreen && Boolean(translateGlossary);
  const promptRowHeight =
    promptRowBaseHeight + (showsNewWordBadge ? (compactPhone ? (tinyPhone ? 30 : 40) : 48) : 0);
  const shouldAutoplayPromptAudio =
    question.kind === "listening_mcq" || (question.kind === "word_bank" && question.audioOnly);
  const showsReferenceCard = question.kind !== "letter_mcq" && !isTranslateChoiceScreen;
  const isLetterChoiceScreen = question.kind === "letter_mcq";
  const letterChoiceMinHeight = compactPhone ? (tinyPhone ? 136 : ultraCompactPhone ? 162 : 180) : 228;
  const letterChoiceFontSize = compactPhone ? (tinyPhone ? 40 : ultraCompactPhone ? 48 : 54) : 68;
  const translateChoiceMinHeight = compactPhone ? (tinyPhone ? 70 : ultraCompactPhone ? 80 : 88) : 106;
  const translateChoiceFontSize = compactPhone ? (tinyPhone ? 24 : ultraCompactPhone ? 28 : 30) : 34;
  const translateChoiceGap = compactPhone ? 12 : 16;
  const choiceTileMinHeight = isLetterChoiceScreen
    ? letterChoiceMinHeight
    : isTranslateChoiceScreen
      ? translateChoiceMinHeight
      : choiceMinHeight;
  const choiceTileFontSize = isLetterChoiceScreen
    ? letterChoiceFontSize
    : isTranslateChoiceScreen
      ? translateChoiceFontSize
      : choiceTextFontSize;
  const choiceTilePadding = isLetterChoiceScreen
    ? compactPhone
      ? 18
      : 24
    : isTranslateChoiceScreen
      ? compactPhone
        ? 16
        : 20
      : compactPhone
        ? 14
        : 20;
  const choiceGridGap = isLetterChoiceScreen
    ? compactPhone
      ? 14
      : 20
    : isTranslateChoiceScreen
      ? translateChoiceGap
      : compactPhone
        ? 12
        : 18;
  const stageUsesTwoColumn =
    desktopLayout &&
    !isTranslateChoiceScreen &&
    (question.kind === "sound_mcq" ||
      question.kind === "listening_mcq" ||
      question.kind === "word_bank");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewport = () =>
      setViewport((current) => {
        const next = { width: window.innerWidth, height: window.innerHeight };
        return current.width === next.width && current.height === next.height ? current : next;
      });
    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const canSubmit = useMemo(() => {
    if (resultState !== "idle") {
      return true;
    }

    switch (question.kind) {
      case "sound_mcq":
      case "letter_mcq":
      case "listening_mcq":
        return Boolean(selectedChoice);
      case "word_bank":
        return selectedWords.length > 0;
    }
  }, [question, resultState, selectedChoice, selectedWords.length]);

  useEffect(() => {
    setIsGlossaryOpen(false);
  }, [question.id]);

  useEffect(() => {
    if (!shouldAutoplayPromptAudio) {
      return;
    }

    const timer = window.setTimeout(() => {
      unlockAudio();
      playLessonAudio(step.id, questionAudioId, questionDisplay);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [questionAudioId, questionDisplay, shouldAutoplayPromptAudio, step.id]);

  useEffect(() => {
    if (!isComplete) {
      return;
    }

    playLessonAudio(step.id, "lesson-complete", "");
    clearStepFailed(lesson.id, step.id);
    markStepCompleted(lesson.id, step.id);
    const timer = window.setTimeout(() => {
      router.replace(`/learn/${lesson.id}`);
    }, 1900);

    return () => window.clearTimeout(timer);
  }, [isComplete, lesson.id, router, step.id]);

  const unlockAudio = () => {
    if (audioUnlockedRef.current) {
      return;
    }

    audioUnlockedRef.current = true;
    void audioService.unlock().catch(() => {
      audioUnlockedRef.current = false;
    });
  };

  const clearBubbleSpeakerTimers = () => {
    if (bubbleSpeakerIntervalRef.current !== null) {
      window.clearTimeout(bubbleSpeakerIntervalRef.current);
      bubbleSpeakerIntervalRef.current = null;
    }

    if (bubbleSpeakerTimeoutRef.current !== null) {
      window.clearTimeout(bubbleSpeakerTimeoutRef.current);
      bubbleSpeakerTimeoutRef.current = null;
    }
  };

  const stopBubbleSpeakerAnimation = () => {
    bubbleSpeakerPlaybackTokenRef.current += 1;
    clearBubbleSpeakerTimers();
    setBubbleSpeakerFrame(3);
  };

  const startBubbleSpeakerAnimation = () => {
    if (typeof window === "undefined") {
      return;
    }

    const bubbleSpeakerFrameDelayMs = 260;

    clearBubbleSpeakerTimers();
    setBubbleSpeakerFrame(1);
    bubbleSpeakerIntervalRef.current = window.setTimeout(() => {
      setBubbleSpeakerFrame(2);
      bubbleSpeakerIntervalRef.current = window.setTimeout(() => {
        setBubbleSpeakerFrame(3);
        bubbleSpeakerIntervalRef.current = null;
      }, bubbleSpeakerFrameDelayMs);
    }, bubbleSpeakerFrameDelayMs);
  };

  const scheduleBubbleSpeakerAnimationStop = (durationMs: number, playbackToken: number) => {
    if (typeof window === "undefined") {
      return;
    }

    if (playbackToken !== bubbleSpeakerPlaybackTokenRef.current) {
      return;
    }

    if (bubbleSpeakerTimeoutRef.current !== null) {
      window.clearTimeout(bubbleSpeakerTimeoutRef.current);
    }

    bubbleSpeakerTimeoutRef.current = window.setTimeout(() => {
      stopBubbleSpeakerAnimation();
    }, Math.max(720, durationMs));
  };

  const playCurrentAudio = () => {
    unlockAudio();
    const shouldAnimateBubbleSpeaker = isTranslateChoiceScreen && Boolean(translateGlossary);

    if (shouldAnimateBubbleSpeaker) {
      startBubbleSpeakerAnimation();
    }

    const playback = playLessonAudio(step.id, questionAudioId, questionDisplay);

    if (shouldAnimateBubbleSpeaker) {
      const playbackToken = bubbleSpeakerPlaybackTokenRef.current + 1;
      bubbleSpeakerPlaybackTokenRef.current = playbackToken;
      void playback.then((durationMs) => {
        scheduleBubbleSpeakerAnimationStop(durationMs, playbackToken);
      });
    }
  };

  useEffect(() => {
    bubbleSpeakerPlaybackTokenRef.current += 1;
    clearBubbleSpeakerTimers();
    setBubbleSpeakerFrame(3);

    return () => {
      bubbleSpeakerPlaybackTokenRef.current += 1;
      clearBubbleSpeakerTimers();
    };
  }, [question.id]);

  const nextQuestion = () => {
    if (index >= QUESTIONS.length - 1) {
      learning.finish();
      return;
    }

    setIndex((current) => current + 1);
    setSelectedChoice(null);
    setSelectedWords([]);
    setIsGlossaryOpen(false);
    setResultState("idle");
  };

  const onCheck = () => {
    let correct = false;

    switch (question.kind) {
      case "sound_mcq":
      case "letter_mcq":
      case "listening_mcq":
        correct = ("acceptedAnswers" in question ? question.acceptedAnswers ?? [question.answer] : [question.answer]).some(answer => normalizeAnswer(answer) === normalizeAnswer(selectedChoice ?? ""));
        break;
      case "word_bank":
        correct = normalizeAnswer(selectedWords.join(" ")) === normalizeAnswer(question.answer);
        break;
    }

    learning.record(question.id, itemsForQuestion(question), correct);

    if (correct) {
      playLessonAudio(step.id, "correct-answer", "");
      setSuccessMessage(SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]);
      setResultState("correct");
      return;
    }

    playLessonAudio(step.id, "incorrect-answer", "");
    markStepFailed(lesson.id, step.id);
    setResultState("wrong");
  };

  const onPrimaryAction = () => {
    if (!canSubmit) {
      return;
    }

    if (resultState !== "idle") {
      nextQuestion();
      return;
    }

    onCheck();
  };

  const feedback =
    resultState === "correct"
      ? successMessage
      : resultState === "wrong"
        ? `Not quite. Correct answer: ${expectedAnswer}`
        : "";

  const renderAudioCard = () => {
    const label =
      question.kind === "sound_mcq"
        ? question.text
        : question.kind === "letter_mcq"
        ? question.sound
        : question.kind === "listening_mcq" || (question.kind === "word_bank" && question.audioOnly)
          ? null
          : question.text;
    const labelIsCoptic = label ? containsCoptic(label) : false;

    return (
      <RecordingCard path={resolveLessonAudio(step.id,questionAudioId)?.src} label={label} coptic={labelIsCoptic} onPlay={playCurrentAudio} fontSize={labelIsCoptic?cardLabelFontSize:compactPhone?54:68} style={{
          width: "100%",
          maxWidth: isTranslateChoiceScreen ? (desktopLayout ? 460 : 400) : desktopLayout ? 420 : 380,
          minHeight: isTranslateChoiceScreen
            ? compactPhone
              ? tinyPhone
                ? 120
                : ultraCompactPhone
                  ? 134
                  : 148
              : 214
            : cardMinHeight,
          borderRadius: cardRadius,
          border: "none",
          background: `linear-gradient(180deg, ${LESSON_THEME.cardTop} 0%, ${LESSON_THEME.cardBottom} 100%)`,
          color: LESSON_THEME.cardText,
          boxShadow: `inset 0 -8px 0 ${LESSON_THEME.cardInset}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: isTranslateChoiceScreen ? (compactPhone ? 18 : 28) : compactPhone ? 18 : 26,
          cursor: "pointer",
          textAlign: "center",
          transform: "translateY(0)",
          transition: "transform 150ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 150ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}/>
    );
  };

  const renderTranslateGlossary = () => {
    if (!translateGlossary) {
      return null;
    }

    const labelIsCoptic = containsCoptic(translateGlossary.label);
    const glossaryLabelFontSize = labelIsCoptic
      ? compactPhone
        ? 23
        : 28
      : compactPhone
        ? 19
        : 22;
    const glossaryCharacterHeight = compactPhone
      ? tinyPhone
        ? 220
        : ultraCompactPhone
          ? 244
          : 262
      : 308;
    const glossaryBubbleBorder = "rgba(115, 131, 150, 0.34)";
    const glossaryBubbleFill = "rgba(255, 255, 255, 0.14)";
    const bubbleSpeakerSrc =
      bubbleSpeakerFrame === 1
        ? "/lesson-2-bubble-speaker-wave1.png"
        : bubbleSpeakerFrame === 2
          ? "/lesson-2-bubble-speaker-wave2.png"
          : "/lesson-2-bubble-speaker.png";

    return (
      <div
        style={{
          display: "flex",
          justifyContent: compactPhone ? "flex-start" : "center",
          alignItems: "flex-start",
          width: "100%",
          paddingLeft: compactPhone ? (tinyPhone ? 18 : 26) : 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            gap: compactPhone ? 4 : 12,
            width: "fit-content",
            maxWidth: "100%",
          }}
        >
          <Image
            src="/lesson-2-guide-saint.png"
            alt=""
            aria-hidden="true"
            width={512}
            height={1024}
            style={{
              height: glossaryCharacterHeight,
              width: "auto",
              objectFit: "contain",
              flexShrink: 0,
              filter: "drop-shadow(0 8px 14px rgba(43, 65, 96, 0.12))",
              userSelect: "none",
              pointerEvents: "none",
              marginLeft: compactPhone ? -4 : -8,
            }}
          />

          <div
            style={{
              position: "relative",
              display: "grid",
              justifyItems: "start",
              width: "fit-content",
              paddingTop: compactPhone ? (tinyPhone ? 38 : ultraCompactPhone ? 46 : 54) : 72,
              transform: compactPhone ? "translateX(-2px)" : "translateX(-10px)",
            }}
          >
            <div
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: compactPhone ? "10px 14px" : "12px 16px",
                borderRadius: compactPhone ? 18 : 22,
                border: `2px solid ${glossaryBubbleBorder}`,
                background: glossaryBubbleFill,
                boxShadow: "0 8px 16px rgba(43, 65, 96, 0.06)",
                zIndex: 1,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: compactPhone ? -7 : -8,
                  top: compactPhone ? "58%" : "56%",
                  width: compactPhone ? 14 : 16,
                  height: compactPhone ? 14 : 16,
                  transform: "translateY(-50%) rotate(45deg)",
                  background: glossaryBubbleFill,
                  borderLeft: `2px solid ${glossaryBubbleBorder}`,
                  borderBottom: `2px solid ${glossaryBubbleBorder}`,
                  borderRadius: 2,
                }}
              />
              <button
                type="button"
                className="lesson-tap-target"
                onClick={playCurrentAudio}
                aria-label="Play prompt audio"
                style={{
                  border: "none",
                  background: "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <Image
                  src={bubbleSpeakerSrc}
                  alt=""
                  aria-hidden="true"
                  width={520}
                  height={512}
                  style={{
                    width: compactPhone ? 31 : 36,
                    height: "auto",
                    display: "block",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />
              </button>

              <button
                type="button"
                className="lesson-tap-target"
                onClick={() => setIsGlossaryOpen((current) => !current)}
                aria-expanded={isGlossaryOpen}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: LESSON_THEME.badgeText,
                cursor: "pointer",
              }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 5,
                  }}
                >
                  <span
                    className={labelIsCoptic ? "coptic-text" : undefined}
                    style={{
                      fontSize: glossaryLabelFontSize,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    {translateGlossary.label}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      width: "100%",
                      height: 4,
                      borderRadius: 999,
                      background: `repeating-linear-gradient(90deg, ${LESSON_THEME.badgeText} 0 9px, transparent 9px 13px)`,
                      opacity: 0.92,
                    }}
                  />
                </span>
                <span
                  style={{
                    color: "rgba(226, 236, 245, 0.86)",
                    transform: isGlossaryOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 160ms ease",
                    display: "inline-flex",
                  }}
                >
                  <IconChevronDown size={compactPhone ? 14 : 16} />
                </span>
              </button>
            </div>

            {isGlossaryOpen ? (
              <div style={{ position: "relative", display: "flex", justifyContent: "center", paddingTop: 12 }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: 6,
                    left: "50%",
                    width: 14,
                    height: 14,
                    transform: "translateX(-50%) rotate(45deg)",
                    background: "rgba(39, 49, 59, 0.98)",
                    borderLeft: "2px solid rgba(115, 131, 150, 0.35)",
                    borderTop: "2px solid rgba(115, 131, 150, 0.35)",
                  }}
                />
                <div
                  style={{
                    minWidth: compactPhone ? 176 : 210,
                    borderRadius: compactPhone ? 18 : 22,
                    overflow: "hidden",
                    background: "rgba(39, 49, 59, 0.98)",
                    border: "2px solid rgba(115, 131, 150, 0.35)",
                    boxShadow: "0 16px 32px rgba(14, 19, 26, 0.18)",
                  }}
                >
                  {translateGlossary.translations.map((translation, translationIndex) => (
                    <div
                      key={`${question.id}-translation-${translation}`}
                      style={{
                        padding: compactPhone ? "12px 18px" : "14px 22px",
                        borderTop:
                          translationIndex === 0 ? "none" : "1px solid rgba(115, 131, 150, 0.28)",
                        color: "#f4f7fb",
                        fontSize: compactPhone ? 20 : 24,
                        fontWeight: 700,
                        lineHeight: 1.1,
                        textAlign: "center",
                      }}
                    >
                      {translation}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const getChoiceState = (choice: string) => {
    const isSelected = selectedChoice === choice;
    const isCorrect = resultState !== "idle" && choice === question.answer;
    const isWrong = resultState === "wrong" && isSelected && choice !== question.answer;

    return {
      isSelected,
      isCorrect,
      isWrong,
      borderColor: isCorrect
        ? LESSON_THEME.choiceCorrectBorder
        : isWrong
          ? LESSON_THEME.choiceWrongBorder
          : isSelected
            ? LESSON_THEME.choiceSelectedBorder
            : LESSON_THEME.choiceBorder,
      background: isCorrect
        ? LESSON_THEME.choiceCorrectBg
        : isWrong
          ? LESSON_THEME.choiceWrongBg
          : isSelected
            ? LESSON_THEME.choiceSelectedBg
            : LESSON_THEME.choiceBg,
      color: isCorrect
        ? LESSON_THEME.choiceCorrectText
        : isWrong
          ? LESSON_THEME.choiceWrongText
          : isSelected
            ? LESSON_THEME.choiceSelectedText
            : LESSON_THEME.textPrimary,
    };
  };

  const renderChoiceButton = (choice: string) => {
    const { isSelected, isCorrect, isWrong, borderColor, background, color } = getChoiceState(choice);

    return (
      <button
        key={choice}
        type="button"
        className="lesson-tap-target lesson-choice-button"
        disabled={resultState !== "idle"}
        onClick={() => setSelectedChoice(choice)}
        style={{
          minHeight: choiceTileMinHeight,
          borderRadius: compactPhone ? 22 : 28,
          border: `3px solid ${borderColor}`,
          background,
          color,
          padding: choiceTilePadding,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontSize: choiceTileFontSize,
          fontWeight: 700,
          lineHeight: 1.05,
          cursor: resultState === "idle" ? "pointer" : "default",
          transform: isSelected && resultState === "idle" ? "translateY(-2px)" : "translateY(0)",
          boxShadow: isSelected && resultState === "idle" ? "0 4px 0 rgba(92, 108, 126, 0.18)" : "none",
          transition:
            "transform 170ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease, background-color 160ms ease, color 160ms ease",
        }}
      >
        <span className={containsCoptic(choice) ? "coptic-text" : undefined}>{choice}</span>
      </button>
    );
  };

  const renderTranslateChoiceChip = (choice: string, inAnswerLane: boolean) => {
    const { borderColor, background, color } = getChoiceState(choice);

    return (
      <button
        key={`${inAnswerLane ? "answer" : "bank"}-${choice}`}
        type="button"
        className="lesson-tap-target"
        disabled={resultState !== "idle"}
        onClick={() => {
          if (resultState !== "idle") {
            return;
          }

          if (inAnswerLane) {
            setSelectedChoice(null);
            return;
          }

          setSelectedChoice(choice);
        }}
        style={{
          borderRadius: 18,
          border: `2px solid ${borderColor}`,
          background,
          color,
          padding: compactPhone ? "12px 16px" : "14px 18px",
          minHeight: compactPhone ? 52 : 58,
          fontSize: compactPhone ? 22 : 26,
          fontWeight: 700,
          lineHeight: 1,
          cursor: resultState === "idle" ? "pointer" : "default",
          boxShadow: inAnswerLane ? "0 2px 0 rgba(92, 108, 126, 0.14)" : "none",
          whiteSpace: "nowrap",
          transition:
            "transform 170ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease, background-color 160ms ease, color 160ms ease",
        }}
      >
        {choice}
      </button>
    );
  };

  const renderInteraction = () => {
    if (question.kind === "listening_mcq" && isTranslateChoiceScreen) {
      const remainingChoices = question.choices.filter((choice) => choice !== selectedChoice);

      return (
        <div style={{ display: "grid", gap: compactPhone ? 18 : 22, alignContent: "start" }}>
          <div style={{ display: "grid", gap: compactPhone ? 18 : 22 }}>
            <div
              style={{
                minHeight: compactPhone ? 58 : 68,
                borderBottom: `3px solid ${LESSON_THEME.wordBankBorder}`,
                display: "flex",
                alignItems: "center",
                gap: 10,
                paddingBottom: 10,
              }}
            >
              {selectedChoice ? renderTranslateChoiceChip(selectedChoice, true) : null}
            </div>

            <div
              style={{
                minHeight: compactPhone ? 52 : 62,
                borderBottom: `3px solid ${LESSON_THEME.wordBankBorder}`,
              }}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {remainingChoices.map((choice) => renderTranslateChoiceChip(choice, false))}
          </div>
        </div>
      );
    }

    if (question.kind === "sound_mcq" || question.kind === "letter_mcq" || question.kind === "listening_mcq") {
      const singleColumn = isTranslateChoiceScreen || question.choices.length <= 3;

      return (
        <div className="lesson-answer-list" data-count={question.choices.length}
          style={{
            display: "grid",
            gridTemplateColumns: singleColumn ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: choiceGridGap,
            alignContent: "start",
            width: "100%",
            maxWidth:
              isTranslateChoiceScreen && singleColumn ? (desktopLayout ? 470 : 410) : undefined,
            margin: isTranslateChoiceScreen && singleColumn ? "0 auto" : undefined,
          }}
        >
          {question.choices.map((choice) => renderChoiceButton(choice))}
        </div>
      );
    }

    if (question.kind === "word_bank") {
      const remainingWords = question.choices.filter((word) => !selectedWords.includes(word));

      return (
        <div style={{ display: "grid", gap: compactPhone ? 14 : 18, alignContent: "start" }}>
          <div
            style={{
              minHeight: compactPhone ? 88 : 96,
              borderRadius: compactPhone ? 20 : 24,
              border: `2px dashed ${LESSON_THEME.wordBankBorder}`,
              background: LESSON_THEME.wordBankBg,
              padding: compactPhone ? 12 : 14,
              display: "flex",
              flexWrap: "wrap",
              alignContent: "flex-start",
              gap: 10,
            }}
          >
            {selectedWords.length > 0 ? (
              selectedWords.map((word) => (
                <button
                  key={`selected-${word}`}
                  type="button"
                  className="lesson-tap-target"
                  disabled={resultState !== "idle"}
                  onClick={() => setSelectedWords((current) => current.filter((entry) => entry !== word))}
                  style={{
                    borderRadius: 16,
                    border: `2px solid ${LESSON_THEME.choiceSelectedBorder}`,
                    background: LESSON_THEME.choiceSelectedBg,
                    color: LESSON_THEME.choiceSelectedText,
                    padding: compactPhone ? "12px 14px" : "14px 18px",
                    fontSize: compactPhone ? 18 : 22,
                    fontWeight: 700,
                    lineHeight: 1,
                    cursor: resultState === "idle" ? "pointer" : "default",
                  }}
                >
                  {word}
                </button>
              ))
            ) : (
              <div
                style={{
                  fontSize: compactPhone ? 18 : 20,
                  fontWeight: 600,
                  color: LESSON_THEME.textSecondary,
                }}
              >
                Tap words below
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {remainingWords.map((word) => (
              <button
                key={word}
                type="button"
                className="lesson-tap-target"
                disabled={resultState !== "idle"}
                onClick={() => setSelectedWords((current) => [...current, word])}
                style={{
                  borderRadius: 16,
                  border: `2px solid ${LESSON_THEME.choiceBorder}`,
                  background: LESSON_THEME.choiceBg,
                  color: LESSON_THEME.textPrimary,
                  padding: compactPhone ? "12px 14px" : "14px 18px",
                  fontSize: compactPhone ? 18 : 22,
                  fontWeight: 700,
                  lineHeight: 1,
                  cursor: resultState === "idle" ? "pointer" : "default",
                }}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  if (isComplete) {
    return <LessonCompleteCelebration message="Great work!" />;
  }

  return (
    <main
      className="authored-exercise"
      onPointerDownCapture={unlockAudio}
      style={{
        height: compactPhone ? "var(--page-content-height)" : "auto",
        minHeight: "var(--page-content-height)",
        background: `linear-gradient(180deg, ${LESSON_THEME.bgTop} 0%, ${LESSON_THEME.bgBottom} 100%)`,
        color: LESSON_THEME.textPrimary,
        padding: shellPadding,
        boxSizing: "border-box",
        overflowX: "hidden",
        overflowY: compactPhone ? "hidden" : "auto",
      }}
    >
      <div
        style={{
          maxWidth: compactPhone ? 760 : 1120,
          margin: "0 auto",
          height: compactPhone ? "100%" : "auto",
          display: "flex",
          flexDirection: "column",
          gap: containerGap,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: compactPhone ? 10 : 14 }}>
          <Link
            href={`/learn/${lesson.id}`}
            className="lesson-tap-target"
            aria-label="Back to unit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: headerButtonSize,
              height: headerButtonSize,
              borderRadius: 999,
              textDecoration: "none",
              color: LESSON_THEME.textSecondary,
              flexShrink: 0,
            }}
          >
            <IconClose />
          </Link>

          <div
            className="lesson-progress-track"
            role="progressbar"
            aria-label="Lesson progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            style={{
              flex: 1,
              height: progressHeight,
              borderRadius: 999,
              background: LESSON_THEME.progressTrack,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress * 100}%`,
                height: "100%",
                borderRadius: 999,
                background: `linear-gradient(90deg, ${LESSON_THEME.progressStart} 0%, ${LESSON_THEME.progressEnd} 100%)`,
                transition: "width 220ms ease",
              }}
            />
          </div>
        </div>

        <div
          style={{
            position: "relative",
            flex: compactPhone ? 1 : "none",
            minHeight: 0,
            height: compactPhone ? undefined : desktopSlideViewportHeight,
            overflow: "hidden",
            isolation: "isolate",
          }}
        >
          <div
            key={question.id}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateRows: desktopLayout
                  ? "auto minmax(0, 1fr)"
                  : showsReferenceCard
                    ? `auto ${cardMinHeight}px minmax(0, 1fr)`
                    : "auto minmax(0, 1fr)",
                gap: slidePanelGap,
                height: "100%",
                minHeight: 0,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  minHeight: 0,
                  paddingTop: compactPhone ? (tinyPhone ? 2 : 4) : 6,
                }}
              >
                <div style={{ display: "grid", gap: showsNewWordBadge ? 10 : 0, alignContent: "start" }}>
                  {showsNewWordBadge ? (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        width: "fit-content",
                        padding: compactPhone ? "7px 11px" : "9px 13px",
                        borderRadius: 999,
                        background: LESSON_THEME.badgeBg,
                        color: LESSON_THEME.badgeText,
                        fontSize: compactPhone ? 13 : 15,
                        fontWeight: 900,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      <span style={{ display: "inline-flex", transform: "translateY(-0.5px)" }}>
                        <IconSparkle size={compactPhone ? 12 : 14} />
                      </span>
                      <span>New word</span>
                    </div>
                  ) : null}

                  <h1
                    style={{
                      margin: 0,
                      fontSize: titleFontSize,
                      lineHeight: 1.2,
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      color: LESSON_THEME.textPrimary,
                      maxWidth: desktopLayout ? "18ch" : undefined,
                    }}
                  >
                    {question.prompt}
                  </h1>
                </div>
              </div>

              {desktopLayout ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: stageUsesTwoColumn
                      ? "minmax(320px, 420px) minmax(360px, 1fr)"
                      : "1fr",
                    gap: 28,
                    minHeight: 0,
                    alignContent: "start",
                    alignItems: "start",
                  }}
                >
                  {showsReferenceCard ? (
                    <div style={{ display: "flex", justifyContent: "center", minHeight: 0 }}>
                      {renderAudioCard()}
                    </div>
                  ) : null}
                  {isTranslateChoiceScreen ? renderTranslateGlossary() : null}
                  <div
                    className="lesson-scroll-panel" data-lesson-scroll
                    style={{
                      display: "grid",
                      gap: compactPhone ? 12 : 18,
                      alignContent: "start",
                      minHeight: 0,
                      overflowY: "auto",
                      paddingRight: 4,
                    }}
                  >
                    {renderInteraction()}
                  </div>
                </div>
              ) : (
                <>
                  {showsReferenceCard ? (
                    <div style={{ display: "flex", justifyContent: "center", minHeight: 0 }}>
                      {renderAudioCard()}
                    </div>
                  ) : null}
                  {isTranslateChoiceScreen ? renderTranslateGlossary() : null}
                  <div
                    className="lesson-scroll-panel" data-lesson-scroll
                    style={{
                      minHeight: 0,
                      overflowY: "auto",
                      paddingBottom: 2,
                    }}
                  >
                    {renderInteraction()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            minHeight: footerShellMinHeight,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              borderRadius: compactPhone ? 18 : 24,
              padding: resultState === "idle" && tinyPhone ? 0 : resultPadding,
              background:
                resultState === "idle"
                  ? "transparent"
                  : resultState === "correct"
                    ? LESSON_THEME.successBg
                    : LESSON_THEME.errorBg,
              border:
                resultState === "idle"
                  ? "1px solid transparent"
                  : `1px solid ${resultState === "correct" ? LESSON_THEME.successBorder : LESSON_THEME.errorBorder}`,
              transform: resultState === "idle" ? "translateY(0)" : "translateY(-6px)",
              transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease, border-color 180ms ease, padding 180ms ease",
            }}
          >
            <div
              style={{
                fontSize: compactPhone ? (ultraCompactPhone ? 16 : 18) : 20,
                fontWeight: 800,
                minHeight: compactPhone ? (ultraCompactPhone ? 20 : 22) : 24,
                visibility: resultState === "idle" ? "hidden" : "visible",
                transform: resultState === "idle" ? "translateY(10px)" : "translateY(0)",
                opacity: resultState === "idle" ? 0 : 1,
                transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
                color: resultState === "wrong" ? LESSON_THEME.choiceWrongText : LESSON_THEME.textPrimary,
              }}
            >
              {feedback || "\u00A0"}
            </div>

            <LessonExplanation question={question} wrong={resultState === "wrong"} />

            <button
              type="button"
              className="lesson-tap-target lesson-action-button"
              onClick={onPrimaryAction}
              disabled={!canSubmit}
              style={{
                marginTop: compactPhone ? 10 : 14,
                width: "100%",
                borderRadius: compactPhone ? 18 : 22,
                border: "none",
                padding: actionButtonPadding,
                background: canSubmit ? LESSON_THEME.actionBg : LESSON_THEME.actionDisabledBg,
                color: canSubmit ? LESSON_THEME.actionText : LESSON_THEME.actionDisabledText,
                boxShadow: canSubmit ? `inset 0 -4px 0 ${LESSON_THEME.actionInset}` : "none",
                fontSize: actionButtonFontSize,
                fontWeight: 900,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                cursor: canSubmit ? "pointer" : "default",
                transform: "translateY(0)",
                transition: "transform 150ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 150ms ease, background-color 120ms ease, color 120ms ease",
              }}
            >
              {resultState !== "idle"
                ? index === QUESTIONS.length - 1
                  ? "Finish"
                  : "Continue"
                : "Check"}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .lesson-tap-target {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .lesson-audio-card:not(:disabled):active {
          transform: translateY(4px) !important;
          box-shadow: inset 0 -3px 0 ${LESSON_THEME.cardInset} !important;
        }

        .lesson-choice-button:not(:disabled):active {
          transform: translateY(0) !important;
          box-shadow: 0 1px 0 rgba(92, 108, 126, 0.18) !important;
        }

        .lesson-action-button:not(:disabled):active {
          transform: translateY(2px) !important;
          box-shadow: inset 0 -1px 0 ${LESSON_THEME.actionInset} !important;
        }

        .lesson-scroll-panel::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>
    </main>
  );
}
