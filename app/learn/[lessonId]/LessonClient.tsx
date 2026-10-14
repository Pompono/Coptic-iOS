"use client";
import {RecordingCard} from "@/app/AudioReplay";

import { LESSON_EXERCISE_SETS, PAIR_LETTERS_EXERCISES, type PairLettersExercise } from "@/lib/learning/letterExercises";
import { LearningSession, LessonExplanation, useLearningSession } from "../learning/LearningSession";
import { itemsForQuestion } from "@/lib/learning/content";
import { LESSON_THEME } from "@/lib/lessonTheme";

import Link from "@/lib/AppLink";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { audioService, reportAudioFailure } from "@/lib/audioService";
import { resolveLessonAudio } from "../../../lib/lessonAudio";
import { clearStepFailed, markStepCompleted, markStepFailed } from "../progress";
import { type ExerciseSetId, type Lesson, type UnitLessonStep } from "../../../lib/lesson";
import Section1Unit2Lesson1Client from "./Section1Unit2Lesson1Client";
import Section1Unit2Lesson2Client from "./Section1Unit2Lesson2Client";

type MatchingTileSelection = {
  side: "left" | "right";
  value: string;
};

type MatchingExerciseLayout = {
  leftChoices: string[];
  rightChoices: string[];
};

type ChoiceExerciseLayout = string[];

const RANDOMIZED_EXERCISE_SETS = new Set<ExerciseSetId>(["section-1-unit-1-review"]);

const EXERCISE_SET_LIFE_LIMITS: Partial<Record<ExerciseSetId, number>> = {
  "section-1-unit-1-review": 5,
};

function buildLessonExerciseQueue(exerciseSet: ExerciseSetId, exercises: PairLettersExercise[]) {
  const nextExercises = [...exercises];
  return RANDOMIZED_EXERCISE_SETS.has(exerciseSet) ? shuffleArray(nextExercises) : nextExercises;
}

const SUCCESS_MESSAGES = [
  "Awesome!",
  "Excellent!",
  "Nice!",
  "Nicely done!",
  "Good job!",
  "Amazing!",
  "Wonderful!",
  "Great work!",
  "Well done!",
  "Perfect!",
];

const COMPLETION_MESSAGES = [
  "Great work!",
  "Amazing job!",
  "Beautiful work!",
  "You crushed it!",
];



function containsCoptic(text: string) {
  return /[\u2C80-\u2CFF\u03E2-\u03EF]/.test(text);
}

function getMatchingTileId(side: "left" | "right", value: string) {
  return `${side}:${value}`;
}

function shuffleArray<T>(items: readonly T[]) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

function buildMatchingExerciseLayouts(exercises: PairLettersExercise[]): Record<string, MatchingExerciseLayout> {
  const layouts: Record<string, MatchingExerciseLayout> = {};

  for (const exercise of exercises) {
    if (exercise.kind !== "matching-pairs") {
      continue;
    }

    layouts[exercise.id] = {
      leftChoices: shuffleArray(exercise.pairs.map((pair) => pair.left)),
      rightChoices: shuffleArray(exercise.pairs.map((pair) => pair.right)),
    };
  }

  return layouts;
}

function buildChoiceExerciseLayouts(exercises: PairLettersExercise[]): Record<string, ChoiceExerciseLayout> {
  const layouts: Record<string, ChoiceExerciseLayout> = {};

  for (const exercise of exercises) {
    if (exercise.kind === "matching-pairs") {
      continue;
    }

    if (exercise.choices.length <= 1) {
      layouts[exercise.id] = [...exercise.choices];
      continue;
    }

    const answerIndex = exercise.choices.indexOf(exercise.answer);
    if (answerIndex === -1) {
      layouts[exercise.id] = shuffleArray(exercise.choices);
      continue;
    }

    const distractors = [...exercise.choices];
    distractors.splice(answerIndex, 1);

    const answerSlot = Math.floor(Math.random() * exercise.choices.length);
    const randomizedChoices = shuffleArray(distractors);
    randomizedChoices.splice(answerSlot, 0, exercise.answer);
    layouts[exercise.id] = randomizedChoices;
  }

  return layouts;
}


const feedbackAudioIds = ["correct-answer", "incorrect-answer", "lesson-complete"] as const;
const LESSON_AUDIO_REWARM_MS = 15000;
let lastLessonAudioWarmAt = 0;

function collectLessonAudioIds(exercises: PairLettersExercise[]) {
  const audioIds = new Set<string>(feedbackAudioIds);

  for (const exercise of exercises) {
    if (exercise.kind === "matching-pairs") {
      for (const pair of exercise.pairs) {
        audioIds.add(pair.right);
      }
      continue;
    }

    const audioId = getExerciseAudioId(exercise);
    if (audioId) {
      audioIds.add(audioId);
    }
  }

  return Array.from(audioIds);
}

async function preloadLessonAudioByIds(
  lessonId: string,
  audioIds: ReadonlyArray<string | null | undefined>
) {
  const entries = new Map<string, { key: string; url: string }>();

  for (const audioId of audioIds) {
    if (!audioId) {
      continue;
    }

    const entry = resolveLessonAudio(lessonId, audioId);
    if (!entry?.src) {
      continue;
    }

    entries.set(entry.src, { key: entry.src, url: entry.src });
  }

  if (entries.size === 0) {
    return;
  }

  await audioService.preloadMany(Array.from(entries.values()));
}

function warmLessonInteractionAudio(lessonId: string, currentAudioId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const now = Date.now();
  if (now - lastLessonAudioWarmAt <= LESSON_AUDIO_REWARM_MS) {
    return;
  }

  lastLessonAudioWarmAt = now;
  void audioService.unlock().catch(() => {
    // Best-effort iOS unlock only.
  });
  void preloadLessonAudioByIds(lessonId, ["correct-answer", "incorrect-answer", currentAudioId]).catch(() => {
    // Best-effort warmup only.
  });
}

function resetLessonAudioWarmState() {
  lastLessonAudioWarmAt = 0;
}

function getExerciseAudioId(exercise: PairLettersExercise | null) {
  if (!exercise || exercise.kind === "matching-pairs") {
    return null;
  }

  return exercise.kind === "roman-to-coptic" ? exercise.audioId ?? null : exercise.audioId;
}

function primeLessonAudioById(lessonId: string, audioId: string | null) {
  if (typeof window === "undefined" || !audioId) {
    return;
  }

  void preloadLessonAudioByIds(lessonId, [audioId]).catch(() => {
    // Best-effort preload only.
  });
}

function primeLessonFeedbackAudio(lessonId: string) {
  void preloadLessonAudioByIds(lessonId, feedbackAudioIds).catch(() => {
    // Best-effort preload only.
  });
}

function primeEntireLessonAudio(lessonId: string, exercises: PairLettersExercise[]) {
  void preloadLessonAudioByIds(lessonId, collectLessonAudioIds(exercises)).catch(() => {
    // Best-effort preload only.
  });
}

function playLessonAudio(lessonId: string, audioId: string, fallbackText: string) {
  const entry = resolveLessonAudio(lessonId, audioId);

  if (typeof window === "undefined") {
    return;
  }

  if (entry?.src) {
    void audioService.play(entry.src, entry.src).catch(reportAudioFailure);
    return;
  }

  reportAudioFailure(new Error(`No bundled recording is available for "${audioId}".`));
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

function IconHeart({
  size = 14,
  active = true,
}: {
  size?: number;
  active?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{
        display: "block",
        color: active ? "#bb5d61" : "rgba(96, 110, 129, 0.28)",
        filter: active ? "drop-shadow(0 1px 0 rgba(110, 47, 52, 0.18))" : "none",
      }}
    >
      <path
        fill="currentColor"
        d="M12 21.3 10.5 20C5.1 15.4 2 12.7 2 9.4 2 6.7 4 4.7 6.7 4.7c1.5 0 3 .7 4 1.8 1-1.1 2.5-1.8 4-1.8C17.9 4.7 20 6.7 20 9.4c0 3.3-3.1 6-8.5 10.6L12 21.3Z"
      />
    </svg>
  );
}

function getLessonActionButtonStyle({
  enabled,
  compactPhone,
  actionButtonFontSize,
  actionButtonPadding,
}: {
  enabled: boolean;
  compactPhone: boolean;
  actionButtonFontSize: number;
  actionButtonPadding: string;
}) {
  const raisedShadow = compactPhone
    ? `inset 0 -7px 0 ${LESSON_THEME.actionInset}`
    : `inset 0 -9px 0 ${LESSON_THEME.actionInset}`;
  const raisedOffset = compactPhone ? -4 : -6;

  return {
    width: "100%",
    borderRadius: compactPhone ? 16 : 20,
    border: "none",
    background: enabled ? LESSON_THEME.actionBg : LESSON_THEME.actionDisabledBg,
    color: enabled ? LESSON_THEME.actionText : LESSON_THEME.actionDisabledText,
    fontSize: actionButtonFontSize,
    fontWeight: 900,
    padding: actionButtonPadding,
    cursor: enabled ? "pointer" : "default",
    transform: enabled ? `translateY(${raisedOffset}px)` : "translateY(0)",
    boxShadow: enabled ? raisedShadow : "none",
    transition:
      "transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 160ms ease, color 160ms ease",
    touchAction: "manipulation" as const,
    WebkitTapHighlightColor: "transparent",
  } as const;
}

function NotFoundLesson() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "var(--text-color)" }}>
      <h1 style={{ fontSize: 40, marginBottom: 8 }}>Lesson not found</h1>
      <p style={{ opacity: 0.85 }}>That lesson id does not exist.</p>
      <p style={{ marginTop: 14 }}>
        <Link href="/learn" style={{ color: "var(--text-color)" }}>
          {"\u2190"} Back to Learn
        </Link>
      </p>
    </main>
  );
}

function PlaceholderLesson({ lesson, step }: { lesson: Lesson; step?: UnitLessonStep }) {
  const heading = step?.title ?? lesson.title;
  const summary = step?.summary ?? lesson.summary;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "var(--text-color)" }}>
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/learn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid var(--border-color)",
            background: "var(--surface-1)",
            color: "var(--text-color)",
            textDecoration: "none",
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          {"\u2190"} Back
        </Link>
      </div>

      <div
        style={{
          borderRadius: 24,
          border: "1px solid var(--border-color)",
          background: "var(--surface-1)",
          padding: 28,
          boxShadow: "0 18px 36px rgba(0, 0, 0, 0.08)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "7px 12px",
            border: "1px solid var(--border-color)",
            background: "rgba(43, 65, 96, 0.08)",
            color: "var(--text-muted)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          {lesson.sectionTitle} • Unit {lesson.unitNumber}
        </div>

        <h1 style={{ fontSize: 40, lineHeight: 1.1, marginTop: 18, marginBottom: 10 }}>{heading}</h1>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 18, lineHeight: 1.6 }}>{summary}</p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
            marginTop: 24,
          }}
        >
          {["Vocabulary set", "Core grammar target", "Practice prompts", "Checkpoint review"].map((label) => (
            <div
              key={label}
              style={{
                borderRadius: 18,
                border: "1px solid var(--border-color)",
                background: "rgba(255, 255, 255, 0.08)",
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 700 }}>{label}</div>
              <p style={{ marginTop: 8, marginBottom: 0, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Placeholder block ready for real lesson content.
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function LessonOutcomeCelebration({
  kicker,
  message,
  subtitle,
  icon,
  isFailure = false,
}: {
  kicker: string;
  message: string;
  subtitle: string;
  icon: "check" | "cross";
  isFailure?: boolean;
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

function LessonFailedCelebration({
  message,
}: {
  message: string;
}) {
  return (
    <LessonOutcomeCelebration
      kicker="Out of lives"
      message={message}
      subtitle="Returning you to the unit map so you can try again..."
      icon="cross"
      isFailure
    />
  );
}

function PairLettersLesson({ lesson, step }: { lesson: Lesson; step: UnitLessonStep & { exerciseSet: ExerciseSetId } }) {
  const router = useRouter();
  const learning = useLearningSession();
  const audioContextId = step.id;
  const exercises = LESSON_EXERCISE_SETS[step.exerciseSet] ?? PAIR_LETTERS_EXERCISES;
  const maxLives = EXERCISE_SET_LIFE_LIMITS[step.exerciseSet] ?? null;
  const usesLives = maxLives !== null;
  const [exerciseQueue, setExerciseQueue] = useState<PairLettersExercise[]>(() =>
    buildLessonExerciseQueue(step.exerciseSet, exercises)
  );
  const [matchingExerciseLayouts, setMatchingExerciseLayouts] = useState<Record<string, MatchingExerciseLayout>>(() =>
    buildMatchingExerciseLayouts(exercises)
  );
  const [choiceExerciseLayouts, setChoiceExerciseLayouts] = useState<Record<string, ChoiceExerciseLayout>>(() =>
    buildChoiceExerciseLayouts(exercises)
  );
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [retryExerciseIds, setRetryExerciseIds] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [pairExplanation, setPairExplanation] = useState<PairLettersExercise | null>(null);
  const [activePairSelection, setActivePairSelection] = useState<MatchingTileSelection | null>(null);
  const [matchedPairTileIds, setMatchedPairTileIds] = useState<string[]>([]);
  const [mismatchedPairTileIds, setMismatchedPairTileIds] = useState<string[]>([]);
  const [recentlyMatchedPairTileIds, setRecentlyMatchedPairTileIds] = useState<string[]>([]);
  const [resultState, setResultState] = useState<"idle" | "correct" | "wrong">("idle");
  const [viewport, setViewport] = useState({ width: 1280, height: 900 });
  const [incomingExerciseIndex, setIncomingExerciseIndex] = useState<number | null>(null);
  const [isSliding, setIsSliding] = useState(false);
  const [remainingLives, setRemainingLives] = useState(maxLives ?? 0);
  const [lifeSpentOnCurrentExercise, setLifeSpentOnCurrentExercise] = useState(false);
  const [successMessage, setSuccessMessage] = useState(SUCCESS_MESSAGES[0]);
  const [completionMessage, setCompletionMessage] = useState(COMPLETION_MESSAGES[0]);
  const [isCelebratingCompletion, setIsCelebratingCompletion] = useState(false);
  const [isCelebratingFailure, setIsCelebratingFailure] = useState(false);
  const slideTimeoutRef = useRef<number | null>(null);
  const completionTimeoutRef = useRef<number | null>(null);
  const pairMismatchTimeoutRef = useRef<number | null>(null);
  const pairMatchTimeoutRef = useRef<number | null>(null);

  const isComplete = exerciseIndex >= exerciseQueue.length;
  const exercise = isComplete ? null : exerciseQueue[exerciseIndex];
  const incomingExercise =
    incomingExerciseIndex !== null && incomingExerciseIndex < exerciseQueue.length
      ? exerciseQueue[incomingExerciseIndex]
      : null;
  const baseProgress = exerciseQueue.length
    ? Math.max(0.08, exerciseIndex / exerciseQueue.length)
    : 0;
  const nextProgress = exerciseQueue.length
    ? Math.max(0.08, Math.min(exerciseIndex + 1, exerciseQueue.length) / exerciseQueue.length)
    : 0;
  const progress = resultState === "idle" ? baseProgress : nextProgress;
  const performanceMode = false;
  const slideDurationMs = 240;
  const progressDurationMs = 220;
  const isRetryRound = exerciseIndex >= exercises.length;
  const retryQuestionsRemaining = isRetryRound ? exerciseQueue.length - exerciseIndex : retryExerciseIds.length;
  const livesBadgeBackground =
    usesLives && remainingLives <= 2 ? LESSON_THEME.errorBg : LESSON_THEME.retryBg;
  const livesBadgeBorder =
    usesLives && remainingLives <= 2 ? LESSON_THEME.errorBorder : LESSON_THEME.retryBorder;
  const livesBadgeText =
    usesLives && remainingLives <= 2 ? LESSON_THEME.choiceWrongText : LESSON_THEME.retryText;

  const clearCompletionTimeout = () => {
    if (completionTimeoutRef.current !== null) {
      window.clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  };

  const clearPairMismatchTimeout = () => {
    if (pairMismatchTimeoutRef.current !== null) {
      window.clearTimeout(pairMismatchTimeoutRef.current);
      pairMismatchTimeoutRef.current = null;
    }
  };

  const clearPairMatchTimeout = () => {
    if (pairMatchTimeoutRef.current !== null) {
      window.clearTimeout(pairMatchTimeoutRef.current);
      pairMatchTimeoutRef.current = null;
    }
  };

  const clearSlideTimeout = () => {
    if (slideTimeoutRef.current !== null) {
      window.clearTimeout(slideTimeoutRef.current);
      slideTimeoutRef.current = null;
    }
  };

  const triggerLessonFailure = () => {
    markStepFailed(lesson.id, step.id);
    clearCompletionTimeout();
    clearPairMismatchTimeout();
    clearPairMatchTimeout();
    clearSlideTimeout();
    setSelectedChoice(null);
    setActivePairSelection(null);
    setMatchedPairTileIds([]);
    setMismatchedPairTileIds([]);
    setRecentlyMatchedPairTileIds([]);
    setResultState("idle");
    setIncomingExerciseIndex(null);
    setIsSliding(false);
    setLifeSpentOnCurrentExercise(false);
    setIsCelebratingCompletion(false);
    setIsCelebratingFailure(true);
  };

  const loseLife = () => {
    if (!usesLives || maxLives === null) {
      return false;
    }

    const nextLives = Math.max(0, remainingLives - 1);
    setRemainingLives(nextLives);

    if (nextLives > 0) {
      return false;
    }

    triggerLessonFailure();
    return true;
  };

  const resetLessonSession = () => {
    const nextExerciseQueue = buildLessonExerciseQueue(step.exerciseSet, exercises);
    clearCompletionTimeout();
    clearPairMismatchTimeout();
    clearPairMatchTimeout();
    clearSlideTimeout();
    setExerciseQueue(nextExerciseQueue);
    setMatchingExerciseLayouts(buildMatchingExerciseLayouts(nextExerciseQueue));
    setChoiceExerciseLayouts(buildChoiceExerciseLayouts(nextExerciseQueue));
    setRetryExerciseIds([]);
    setPairExplanation(null);
    setExerciseIndex(0);
    setSelectedChoice(null);
    setActivePairSelection(null);
    setMatchedPairTileIds([]);
    setMismatchedPairTileIds([]);
    setRecentlyMatchedPairTileIds([]);
    setResultState("idle");
    setIncomingExerciseIndex(null);
    setIsSliding(false);
    setRemainingLives(maxLives ?? 0);
    setLifeSpentOnCurrentExercise(false);
    setSuccessMessage(SUCCESS_MESSAGES[0]);
    setCompletionMessage(COMPLETION_MESSAGES[0]);
    setIsCelebratingCompletion(false);
    setIsCelebratingFailure(false);
  };

  useEffect(() => {
    resetLessonSession();
  }, [exercises, maxLives, step.exerciseSet, step.id]);

  useEffect(() => {
    const updateViewport = () => {
      setViewport((current) => {
        const next = {
          width: window.innerWidth,
          height: window.innerHeight,
        };

        return current.width === next.width && current.height === next.height ? current : next;
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    primeLessonFeedbackAudio(audioContextId);
    primeEntireLessonAudio(audioContextId, exercises);
  }, [audioContextId, exercises]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      resetLessonAudioWarmState();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    return () => {
      if (slideTimeoutRef.current !== null) {
        window.clearTimeout(slideTimeoutRef.current);
      }
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
      }
      if (pairMismatchTimeoutRef.current !== null) {
        window.clearTimeout(pairMismatchTimeoutRef.current);
      }
      if (pairMatchTimeoutRef.current !== null) {
        window.clearTimeout(pairMatchTimeoutRef.current);
      }
      audioService.stopAll();
    };
  }, []);

  useEffect(() => {
    if (!isCelebratingCompletion && !isCelebratingFailure) {
      return;
    }

    completionTimeoutRef.current = window.setTimeout(() => {
      router.replace(`/learn/${lesson.id}`);
    }, 1900);

    return () => {
      if (completionTimeoutRef.current !== null) {
        window.clearTimeout(completionTimeoutRef.current);
        completionTimeoutRef.current = null;
      }
    };
  }, [isCelebratingCompletion, isCelebratingFailure, lesson.id, router]);

  useEffect(() => {
    primeLessonAudioById(audioContextId, getExerciseAudioId(exercise));
  }, [audioContextId, exercise]);

  if (isCelebratingFailure) {
    return <LessonFailedCelebration message="Out of lives" />;
  }

  if (isCelebratingCompletion || isComplete) {
    return <LessonCompleteCelebration message={completionMessage} />;
  }

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
  const speakerScale = compactPhone ? 1.2 : 1.8;
  const resultPadding = compactPhone ? (tinyPhone ? 10 : ultraCompactPhone ? 12 : 14) : 18;
  const actionButtonPadding = compactPhone ? (tinyPhone ? "12px 14px" : ultraCompactPhone ? "14px 16px" : "16px 18px") : "18px 20px";
  const actionButtonFontSize = compactPhone ? (tinyPhone ? 16 : ultraCompactPhone ? 18 : 20) : 22;
  const footerShellMinHeight = compactPhone ? 76 : 100;
  const promptRowHeight = compactPhone ? (tinyPhone ? 52 : 64) : 96;
  const slidePanelGap = compactPhone ? (tinyPhone ? 12 : ultraCompactPhone ? 14 : 16) : 20;
  const desktopSlideViewportHeight = 520;

  const onCheck = () => {
    if (!selectedChoice || exercise.kind === "matching-pairs") return;

    const correct = selectedChoice === exercise.answer;
    learning.record(exercise.id, itemsForQuestion(exercise), correct);
    if (correct) {
      const nextMessage = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
      playLessonAudio(audioContextId, "correct-answer", "");
      startTransition(() => {
        setSuccessMessage(nextMessage);
        setResultState("correct");
      });
    } else {
      playLessonAudio(audioContextId, "incorrect-answer", "");
      const exhaustedLives = loseLife();
      startTransition(() => {
        if (exhaustedLives) {
          return;
        }

        setExerciseQueue((current) => {
          if (retryExerciseIds.includes(exercise.id)) {
            return current;
          }

          return [...current, exercise];
        });
        setRetryExerciseIds((current) => (current.includes(exercise.id) ? current : [...current, exercise.id]));
        setResultState("wrong");
      });
    }
  };

  const onPairTilePress = (side: "left" | "right", value: string) => {
    if (exercise.kind !== "matching-pairs" || isSliding || resultState === "correct") {
      return;
    }

    const tileId = getMatchingTileId(side, value);
    if (matchedPairTileIds.includes(tileId)) {
      return;
    }

    clearPairMismatchTimeout();
    setMismatchedPairTileIds([]);

    if (!activePairSelection) {
      setActivePairSelection({ side, value });
      return;
    }

    if (activePairSelection.side === side) {
      if (activePairSelection.value === value) {
        setActivePairSelection(null);
        return;
      }

      setActivePairSelection({ side, value });
      return;
    }

    const leftValue = side === "left" ? value : activePairSelection.value;
    const rightValue = side === "right" ? value : activePairSelection.value;
    const nextMatchedTileIds = [
      getMatchingTileId("left", leftValue),
      getMatchingTileId("right", rightValue),
    ];
    const isCorrectPair = exercise.pairs.some(
      (pair) => pair.left === leftValue && pair.right === rightValue
    );

    learning.record(exercise.id + ":" + leftValue, itemsForQuestion({kind:"matching-pairs",pairs:exercise.pairs.filter(pair => pair.left === leftValue)}), isCorrectPair);

    if (isCorrectPair) {
      const merged = [...matchedPairTileIds];
      for (const nextTileId of nextMatchedTileIds) {
        if (!merged.includes(nextTileId)) {
          merged.push(nextTileId);
        }
      }
      const completedAllPairs = merged.length === exercise.pairs.length * 2;
      setActivePairSelection(null);
      setRecentlyMatchedPairTileIds(nextMatchedTileIds);
      if (completedAllPairs) {
        playLessonAudio(audioContextId, "correct-answer", "");
        startTransition(() => {
          setSuccessMessage(SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]);
        });
      }
      clearPairMatchTimeout();
      pairMatchTimeoutRef.current = window.setTimeout(() => {
        setMatchedPairTileIds((current) => {
          const nextMatched = [...current];
          for (const nextTileId of nextMatchedTileIds) {
            if (!nextMatched.includes(nextTileId)) {
              nextMatched.push(nextTileId);
            }
          }
          return nextMatched;
        });
        setRecentlyMatchedPairTileIds([]);
        if (completedAllPairs) {
          setResultState("correct");
        }
        pairMatchTimeoutRef.current = null;
      }, 300);

      return;
    }

    setActivePairSelection(null);
    setMismatchedPairTileIds(nextMatchedTileIds);
    setPairExplanation({ ...exercise, pairs: exercise.pairs.filter(pair => pair.left === leftValue) });
    playLessonAudio(audioContextId, "incorrect-answer", "");
    const shouldChargeLife = usesLives && !lifeSpentOnCurrentExercise;
    if (shouldChargeLife) {
      setLifeSpentOnCurrentExercise(true);
      if (loseLife()) {
        return;
      }
    }
    pairMismatchTimeoutRef.current = window.setTimeout(() => {
      setMismatchedPairTileIds([]);
      pairMismatchTimeoutRef.current = null;
    }, 420);
  };

  const onContinue = () => {
    if (isSliding) {
      return;
    }

    clearPairMismatchTimeout();
    clearPairMatchTimeout();
    setPairExplanation(null);
    const nextIndex = exerciseIndex + 1;
    const nextExercise = exerciseQueue[nextIndex] ?? null;

    if (nextIndex >= exerciseQueue.length) {
      learning.finish();
      return;
    }

    primeLessonAudioById(audioContextId, getExerciseAudioId(nextExercise));
    if (nextExercise?.kind === "hear-and-choose") {
      playLessonAudio(audioContextId, nextExercise.audioId, nextExercise.audioId);
    }

    setIncomingExerciseIndex(nextIndex);

    requestAnimationFrame(() => {
      setIsSliding(true);
      slideTimeoutRef.current = window.setTimeout(() => {
        setExerciseIndex(nextIndex);
        setIncomingExerciseIndex(null);
        setSelectedChoice(null);
        setActivePairSelection(null);
        setMatchedPairTileIds([]);
        setMismatchedPairTileIds([]);
        setRecentlyMatchedPairTileIds([]);
        setResultState("idle");
        setIsSliding(false);
        setLifeSpentOnCurrentExercise(false);
        slideTimeoutRef.current = null;
      }, slideDurationMs);
    });
  };

  const renderExercisePanel = (
    targetExercise: PairLettersExercise,
    panelSelectedChoice: string | null,
    panelResultState: "idle" | "correct" | "wrong",
    panelSliding: boolean,
    panelActivePairSelection: MatchingTileSelection | null,
    panelMatchedPairTileIds: string[],
    panelMismatchedPairTileIds: string[],
    panelRecentlyMatchedPairTileIds: string[]
  ) => {
    if (targetExercise.kind === "matching-pairs") {
      const matchingLayout = matchingExerciseLayouts[targetExercise.id];
      const leftChoices = matchingLayout?.leftChoices ?? targetExercise.pairs.map((pair) => pair.left);
      const rightChoices =
        matchingLayout?.rightChoices ?? [...targetExercise.pairs.map((pair) => pair.right)].reverse();
      const renderMatchingTile = (side: "left" | "right", value: string) => {
        const tileId = getMatchingTileId(side, value);
        const isSelected =
          panelActivePairSelection?.side === side && panelActivePairSelection.value === value;
        const isRecentlyMatched = panelRecentlyMatchedPairTileIds.includes(tileId);
        const isMatched = panelMatchedPairTileIds.includes(tileId);
        const isWrong = panelMismatchedPairTileIds.includes(tileId);
        const renderCoptic = containsCoptic(value);

        return (
          <button
            key={tileId}
            type="button"
            className="lesson-tap-target lesson-matching-tile"
            data-selected={isSelected ? "true" : "false"}
            disabled={panelSliding || isMatched || isRecentlyMatched}
            onClick={() => {
              if (side === "left") {
                const pairAudioId = targetExercise.pairs.find((pair) => pair.left === value)?.right;
                if (pairAudioId) {
                  playLessonAudio(audioContextId, pairAudioId, pairAudioId);
                }
              }

              onPairTilePress(side, value);
            }}
            style={{
              minHeight: choiceMinHeight,
              borderRadius: compactPhone ? 22 : 28,
              border: `${compactPhone ? 3 : 4}px solid ${
                isRecentlyMatched
                  ? LESSON_THEME.recentMatchBorder
                  : isMatched
                  ? LESSON_THEME.matchedBorder
                  : isWrong
                  ? LESSON_THEME.choiceWrongBorder
                  : isSelected
                    ? LESSON_THEME.choiceSelectedBorder
                    : LESSON_THEME.choiceBorder
              }`,
              background: isRecentlyMatched
                ? LESSON_THEME.recentMatchBg
                : isMatched
                ? LESSON_THEME.matchedBg
                : isSelected
                  ? LESSON_THEME.choiceSelectedBg
                  : LESSON_THEME.choiceBg,
              color: isRecentlyMatched
                ? LESSON_THEME.matchedText
                : isMatched
                  ? "var(--lesson-matched-muted-text, rgba(226, 236, 245, 0.42))"
                  : isSelected
                    ? LESSON_THEME.choiceSelectedText
                    : LESSON_THEME.textPrimary,
              cursor: panelSliding || isMatched || isRecentlyMatched ? "default" : "pointer",
              padding: compactPhone ? 14 : 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              boxSizing: "border-box",
              transform: isMatched ? "translateY(0)" : "translateY(-3px)",
              boxShadow: isRecentlyMatched
                ? "0 0 0 2px rgba(147, 168, 120, 0.18), 0 4px 0 rgba(96, 119, 71, 0.58)"
                : isMatched
                ? "inset 0 1px 0 rgba(255, 255, 255, 0.03)"
                : isSelected
                  ? "0 0 0 2px rgba(159, 177, 196, 0.22), 0 4px 0 rgba(86, 103, 123, 0.58)"
                  : "0 4px 0 rgba(63, 81, 100, 0.42)",
              opacity: isMatched ? 0.86 : 1,
              transition:
                performanceMode
                  ? "background-color 100ms ease, border-color 100ms ease, color 100ms ease, opacity 100ms ease"
                  : "transform 170ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease, background-color 160ms ease, color 160ms ease, opacity 160ms ease",
            }}
          >
            <span
              className={renderCoptic ? "coptic-text" : undefined}
              style={{
                fontSize: choiceTextFontSize,
                fontWeight: 700,
                lineHeight: 1.05,
              }}
            >
              {value}
            </span>
          </button>
        );
      };

      return (
        <div
          style={{
            display: "grid",
            gridTemplateRows: "auto minmax(0, 1fr)",
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
            <h1
              style={{
                fontSize: titleFontSize,
                lineHeight: 1.2,
                margin: 0,
                color: LESSON_THEME.textPrimary,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              {targetExercise.prompt}
            </h1>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: compactPhone ? 12 : 18,
              minHeight: 0,
              overflowY: "auto",
              alignContent: "start",
            }}
          >
            <div style={{ display: "grid", gap: gridGap, alignContent: "start" }}>
              {leftChoices.map((choice) => renderMatchingTile("left", choice))}
            </div>
            <div style={{ display: "grid", gap: gridGap, alignContent: "start" }}>
              {rightChoices.map((choice) => renderMatchingTile("right", choice))}
            </div>
          </div>
        </div>
      );
    }

    const panelShowChoiceGrid = targetExercise.kind !== "sound-to-roman";
    const panelCardLabel = targetExercise.kind === "hear-and-choose" ? null : targetExercise.display;
    const panelCardLabelIsCoptic = panelCardLabel ? containsCoptic(panelCardLabel) : false;
    const panelExerciseAudioId = getExerciseAudioId(targetExercise);
    const panelChoices = choiceExerciseLayouts[targetExercise.id] ?? targetExercise.choices;
    const panelExerciseAudioFallback =
      targetExercise.kind === "roman-to-coptic" ? targetExercise.display : targetExercise.audioId;

    return (
      <div
        style={{
          display: "grid",
          gridTemplateRows: desktopLayout ? "auto minmax(0, 1fr)" : `${promptRowHeight}px ${cardMinHeight}px minmax(0, 1fr)`,
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
          <h1
            style={{
              fontSize: titleFontSize,
              lineHeight: 1.2,
              margin: 0,
                color: LESSON_THEME.textPrimary,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {targetExercise.prompt}
          </h1>
        </div>

        {desktopLayout ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(320px, 420px) minmax(360px, 1fr)",
              gap: 28,
              minHeight: 0,
              overflowY: "auto",
              alignContent: "start",
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", minHeight: 0 }}>
              <RecordingCard path={resolveLessonAudio(audioContextId,panelExerciseAudioId)?.src} label={panelCardLabel} coptic={panelCardLabelIsCoptic} onPlay={() => {
                  if (panelExerciseAudioId) {
                    playLessonAudio(audioContextId, panelExerciseAudioId, panelExerciseAudioFallback);
                    return;
                  }

                  if (targetExercise.kind !== "hear-and-choose") {
                    reportAudioFailure(new Error(`No bundled recording is available for "${targetExercise.display}".`));
                  }
                }} fontSize={cardLabelFontSize} style={{
                  width: "100%",
                  maxWidth: 420,
                  minHeight: cardMinHeight,
                  borderRadius: cardRadius,
                  border: "none",
                  background: `linear-gradient(180deg, ${LESSON_THEME.cardTop} 0%, ${LESSON_THEME.cardBottom} 100%)`,
                  color: LESSON_THEME.cardText,
                  boxShadow: `inset 0 -8px 0 ${LESSON_THEME.cardInset}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  padding: cardPadding,
                  cursor: "pointer",
                  flexShrink: 0,
                  transform: "translateY(0)",
                  transition: performanceMode
                    ? "background-color 100ms ease, color 100ms ease"
                    : "transform 150ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 150ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}/>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: panelShowChoiceGrid ? "repeat(2, minmax(0, 1fr))" : "1fr",
                gap: gridGap,
                minHeight: 0,
                overflowY: "auto",
                alignContent: "start",
              }}
            >
              {panelChoices.map((choice) => {
                const isSelected = panelSelectedChoice === choice;
                const isCorrect = panelResultState !== "idle" && choice === targetExercise.answer;
                const isWrong = panelResultState === "wrong" && isSelected && choice !== targetExercise.answer;
                const renderCoptic = containsCoptic(choice);

                return (
                  <button
                    key={choice}
                    type="button"
                    className="lesson-tap-target lesson-option-button"
                    disabled={panelResultState !== "idle" || panelSliding}
                    onClick={() => setSelectedChoice(choice)}
                    style={{
                      minHeight: choiceMinHeight,
                      borderRadius: compactPhone ? 22 : 28,
                      border: `${compactPhone ? 3 : 4}px solid ${
                        isCorrect
                          ? LESSON_THEME.choiceCorrectBorder
                          : isWrong
                            ? LESSON_THEME.choiceWrongBorder
                            : isSelected
                              ? LESSON_THEME.choiceSelectedBorder
                              : LESSON_THEME.choiceBorder
                      }`,
                      background: isCorrect
                        ? LESSON_THEME.choiceCorrectBg
                        : isSelected
                          ? LESSON_THEME.choiceSelectedBg
                          : isWrong
                            ? LESSON_THEME.choiceWrongBg
                            : LESSON_THEME.choiceBg,
                      color: isCorrect
                        ? LESSON_THEME.choiceCorrectText
                        : isWrong
                          ? LESSON_THEME.choiceWrongText
                          : isSelected
                            ? LESSON_THEME.choiceSelectedText
                            : LESSON_THEME.textPrimary,
                      cursor: panelResultState === "idle" && !panelSliding ? "pointer" : "default",
                      padding: compactPhone ? 14 : 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      boxSizing: "border-box",
                      transform: isSelected && panelResultState === "idle" ? "translateY(-2px)" : "translateY(0)",
                      boxShadow:
                        isSelected && panelResultState === "idle"
                          ? "0 4px 0 rgba(92, 108, 126, 0.18)"
                          : "none",
                      transition:
                        performanceMode
                          ? "background-color 100ms ease, border-color 100ms ease, color 100ms ease"
                          : "transform 170ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease, background-color 160ms ease, color 160ms ease",
                    }}
                  >
                    <span
                      className={renderCoptic ? "coptic-text" : undefined}
                      style={{
                        fontSize: choiceTextFontSize,
                        fontWeight: 700,
                        lineHeight: 1.05,
                      }}
                    >
                      {choice}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "center", minHeight: 0 }}>
              <RecordingCard path={resolveLessonAudio(audioContextId,panelExerciseAudioId)?.src} label={panelCardLabel} coptic={panelCardLabelIsCoptic} onPlay={() => {
                  if (panelExerciseAudioId) {
                    playLessonAudio(audioContextId, panelExerciseAudioId, panelExerciseAudioFallback);
                    return;
                  }

                  if (targetExercise.kind !== "hear-and-choose") {
                    reportAudioFailure(new Error(`No bundled recording is available for "${targetExercise.display}".`));
                  }
                }} fontSize={cardLabelFontSize} style={{
                  width: "100%",
                  maxWidth: 420,
                  minHeight: cardMinHeight,
                  borderRadius: cardRadius,
                  border: "none",
                  background: `linear-gradient(180deg, ${LESSON_THEME.cardTop} 0%, ${LESSON_THEME.cardBottom} 100%)`,
                  color: LESSON_THEME.cardText,
                  boxShadow: `inset 0 -8px 0 ${LESSON_THEME.cardInset}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  padding: cardPadding,
                  cursor: "pointer",
                  flexShrink: 0,
                  transform: "translateY(0)",
                  transition: performanceMode
                    ? "background-color 100ms ease, color 100ms ease"
                    : "transform 150ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 150ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}/>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: panelShowChoiceGrid ? "repeat(2, minmax(0, 1fr))" : "1fr",
                gap: gridGap,
                minHeight: 0,
                overflowY: "auto",
                alignContent: "start",
              }}
            >
              {panelChoices.map((choice) => {
                const isSelected = panelSelectedChoice === choice;
                const isCorrect = panelResultState !== "idle" && choice === targetExercise.answer;
                const isWrong = panelResultState === "wrong" && isSelected && choice !== targetExercise.answer;
                const renderCoptic = containsCoptic(choice);

                return (
                  <button
                    key={choice}
                    type="button"
                    className="lesson-tap-target lesson-option-button"
                    disabled={panelResultState !== "idle" || panelSliding}
                    onClick={() => setSelectedChoice(choice)}
                    style={{
                      minHeight: choiceMinHeight,
                      borderRadius: compactPhone ? 22 : 28,
                      border: `${compactPhone ? 3 : 4}px solid ${
                        isCorrect
                          ? LESSON_THEME.choiceCorrectBorder
                          : isWrong
                            ? LESSON_THEME.choiceWrongBorder
                            : isSelected
                              ? LESSON_THEME.choiceSelectedBorder
                              : LESSON_THEME.choiceBorder
                      }`,
                      background: isCorrect
                        ? LESSON_THEME.choiceCorrectBg
                        : isSelected
                          ? LESSON_THEME.choiceSelectedBg
                          : isWrong
                            ? LESSON_THEME.choiceWrongBg
                            : LESSON_THEME.choiceBg,
                      color: isCorrect
                        ? LESSON_THEME.choiceCorrectText
                        : isWrong
                          ? LESSON_THEME.choiceWrongText
                          : isSelected
                            ? LESSON_THEME.choiceSelectedText
                            : LESSON_THEME.textPrimary,
                      cursor: panelResultState === "idle" && !panelSliding ? "pointer" : "default",
                      padding: compactPhone ? 14 : 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      boxSizing: "border-box",
                      transform: isSelected && panelResultState === "idle" ? "translateY(-2px)" : "translateY(0)",
                      boxShadow:
                        isSelected && panelResultState === "idle"
                          ? "0 4px 0 rgba(92, 108, 126, 0.18)"
                          : "none",
                      transition:
                        performanceMode
                          ? "background-color 100ms ease, border-color 100ms ease, color 100ms ease"
                          : "transform 170ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease, background-color 160ms ease, color 160ms ease",
                    }}
                  >
                    <span
                      className={renderCoptic ? "coptic-text" : undefined}
                      style={{
                        fontSize: choiceTextFontSize,
                        fontWeight: 700,
                        lineHeight: 1.05,
                      }}
                    >
                      {choice}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <main
      className="authored-exercise"
      onPointerDownCapture={() => warmLessonInteractionAudio(lesson.id, getExerciseAudioId(exercise))}
      style={{
        height: compactPhone ? "var(--page-content-height)" : "auto",
        minHeight: "var(--page-content-height)",
        background: `linear-gradient(180deg, ${LESSON_THEME.bgTop} 0%, ${LESSON_THEME.bgBottom} 100%)`,
        color: LESSON_THEME.textPrimary,
        padding: shellPadding,
        overflowX: "hidden",
        overflowY: compactPhone ? "hidden" : "auto",
        boxSizing: "border-box",
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
            href="/learn"
            className="lesson-tap-target"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: headerButtonSize,
              height: headerButtonSize,
              borderRadius: 999,
              textDecoration: "none",
              color: LESSON_THEME.textSecondary,
            }}
            aria-label="Back to learn"
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
                transition: progressDurationMs ? `width ${progressDurationMs}ms ease` : "none",
              }}
            />
          </div>
        </div>

        {usesLives ? (
          <div
            style={{
              alignSelf: "flex-start",
              borderRadius: 999,
              padding: compactPhone ? "6px 10px" : "8px 12px",
              background: livesBadgeBackground,
              border: `1px solid ${livesBadgeBorder}`,
              color: "transparent",
              fontSize: 0,
              lineHeight: 0,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              display: "inline-flex",
              alignItems: "center",
              gap: compactPhone ? 8 : 10,
            }}
          >
            Lives · {remainingLives}/{maxLives}
            <span
              aria-hidden="true"
              style={{
                fontSize: compactPhone ? 12 : 13,
                lineHeight: 1,
                color: livesBadgeText,
              }}
            >
              Lives
            </span>
            <span
              aria-label={`${remainingLives} of ${maxLives} lives remaining`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: compactPhone ? 4 : 5,
              }}
            >
              {Array.from({ length: maxLives ?? 0 }, (_, index) => (
                <IconHeart
                  key={`life-${index}`}
                  size={compactPhone ? 13 : 14}
                  active={index < remainingLives}
                />
              ))}
            </span>
          </div>
        ) : null}

        {isRetryRound ? (
          <div
            style={{
              alignSelf: "flex-start",
              borderRadius: 999,
              padding: compactPhone ? "6px 10px" : "8px 12px",
              background: LESSON_THEME.retryBg,
              border: `1px solid ${LESSON_THEME.retryBorder}`,
              color: LESSON_THEME.retryText,
              fontSize: compactPhone ? 12 : 13,
              fontWeight: 800,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            Retry round{retryQuestionsRemaining > 0 ? ` · ${retryQuestionsRemaining} left` : ""}
          </div>
        ) : null}

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
            key={`current-${exercise.id}`}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              transform: isSliding ? "translate3d(-100%, 0, 0)" : "translate3d(0, 0, 0)",
              transition: slideDurationMs
                ? `transform ${slideDurationMs}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                : "none",
              backfaceVisibility: "hidden",
              contain: "layout paint",
            }}
          >
            {renderExercisePanel(
              exercise,
              selectedChoice,
              resultState,
              isSliding,
              activePairSelection,
              matchedPairTileIds,
              mismatchedPairTileIds,
              recentlyMatchedPairTileIds
            )}
          </div>

          {incomingExercise ? (
            <div
              key={`incoming-${incomingExercise.id}`}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                transform: isSliding ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
                transition: slideDurationMs
                  ? `transform ${slideDurationMs}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
                  : "none",
                backfaceVisibility: "hidden",
                contain: "layout paint",
              }}
            >
              {renderExercisePanel(incomingExercise, null, "idle", true, null, [], [], [])}
            </div>
          ) : null}
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
              transition:
                performanceMode
                  ? "background-color 120ms ease, border-color 120ms ease, padding 120ms ease"
                  : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease, border-color 180ms ease, padding 180ms ease",
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
                transition: performanceMode
                  ? "opacity 120ms ease"
                  : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease",
              }}
            >
              {resultState === "correct"
                ? successMessage
                : exercise.kind === "matching-pairs"
                  ? "Try again."
                  : `Not quite. Correct answer: ${exercise.answer}`}
            </div>
            <LessonExplanation question={pairExplanation ?? exercise} wrong={resultState === "wrong" || Boolean(pairExplanation)} />
            {resultState !== "idle" ? (
              <button
                type="button"
                className="lesson-tap-target lesson-action-button"
                onClick={onContinue}
                disabled={isSliding}
                style={{
                  marginTop: compactPhone ? 10 : 14,
                  ...getLessonActionButtonStyle({
                    enabled: !isSliding,
                    compactPhone,
                    actionButtonFontSize,
                    actionButtonPadding,
                  }),
                }}
              >
                Continue
              </button>
            ) : exercise.kind === "matching-pairs" ? null : (
              <button
                type="button"
                className="lesson-tap-target lesson-action-button"
                onClick={() => selectedChoice && onCheck()}
                disabled={!selectedChoice || isSliding}
                style={{
                  marginTop: compactPhone ? 10 : 14,
                  ...getLessonActionButtonStyle({
                    enabled: Boolean(selectedChoice) && !isSliding,
                    compactPhone,
                    actionButtonFontSize,
                    actionButtonPadding,
                  }),
                }}
              >
                Check
              </button>
            )}
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

        .lesson-matching-tile:not(:disabled):active {
          transform: translateY(0) !important;
          box-shadow: 0 1px 0 rgba(63, 81, 100, 0.42) !important;
        }

        .lesson-matching-tile[data-selected="true"]:not(:disabled):active {
          box-shadow: 0 0 0 2px rgba(159, 177, 196, 0.22), 0 1px 0 rgba(86, 103, 123, 0.58) !important;
        }

        .lesson-option-button:not(:disabled):active {
          transform: translateY(0) !important;
          box-shadow: 0 1px 0 rgba(92, 108, 126, 0.18) !important;
        }

        .lesson-action-button:not(:disabled):active {
          transform: translateY(0) !important;
          box-shadow: inset 0 -1px 0 ${LESSON_THEME.actionInset} !important;
        }
      `}</style>
    </main>
  );
}

function GenericLesson({ lesson }: { lesson: Lesson }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [status, setStatus] = useState<"idle" | "correct" | "wrong">("idle");

  const step = lesson.steps[stepIndex];

  if (!step) {
    return <PlaceholderLesson lesson={lesson} />;
  }

  const onCheck = () => {
    const normalized = typed.trim().replace(/\s+/g, " ");
    const expected = step.answer.trim().replace(/\s+/g, " ");
    setStatus(normalized === expected ? "correct" : "wrong");
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, color: "var(--text-color)" }}>
      <div style={{ marginBottom: 14 }}>
        <Link
          href="/learn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 999,
            border: "1px solid var(--border-color)",
            background: "var(--surface-1)",
            color: "var(--text-color)",
            textDecoration: "none",
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          {"\u2190"} Back
        </Link>
      </div>

      <div style={{ opacity: 0.85, marginBottom: 6 }}>{lesson.title}</div>
      <h1 style={{ fontSize: 28, margin: 0 }}>Step {stepIndex + 1}</h1>
      <p style={{ marginTop: 18, fontSize: 18 }}>{step.prompt}</p>

      <input
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
          setStatus("idle");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onCheck();
          }
        }}
        placeholder="Type here..."
        autoFocus
        spellCheck={false}
        autoComplete="off"
        style={{
          marginTop: 14,
          width: "100%",
          padding: 14,
          borderRadius: 12,
          background: "var(--surface-1)",
          border: "1px solid var(--border-color)",
          minHeight: 56,
          fontSize: 26,
          color: "var(--text-color)",
          outline: "none",
          fontFamily: "var(--coptic-font-family)",
          fontWeight: 500,
        }}
      />

      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onCheck}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "var(--accent-color)",
            color: "var(--accent-contrast-color)",
            fontWeight: 800,
            border: "none",
            cursor: "pointer",
          }}
        >
          Check
        </button>

        {status === "correct" ? (
          <button
            type="button"
            onClick={() => {
              const isLast = stepIndex >= lesson.steps.length - 1;
              if (isLast) {
                setTyped("");
                setStatus("idle");
                return;
              }
              setStepIndex((current) => current + 1);
              setTyped("");
              setStatus("idle");
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "var(--surface-2)",
              color: "var(--text-color)",
              fontWeight: 700,
              border: "1px solid var(--border-color)",
              cursor: "pointer",
            }}
          >
            Next
          </button>
        ) : null}

        {status === "correct" ? <span style={{ color: "#2f9e44", fontWeight: 800 }}>Correct</span> : null}
        {status === "wrong" ? (
          <span style={{ color: "#d9485f", fontWeight: 800 }}>Try again. Expected: {step.answer}</span>
        ) : null}
      </div>
    </main>
  );
}

export default function LessonClient({ lesson, step }: { lesson: Lesson; step: UnitLessonStep }) {
  if (!step.exerciseSet) return <PlaceholderLesson lesson={lesson} step={step} />;
  if (step.exerciseSet.startsWith("bohairic-")) return <LearningSession key={step.id} lesson={lesson} step={step} newLesson />;
  const exercise = step.exerciseSet === "section-1-unit-2-group-1-lesson-1"
    ? <Section1Unit2Lesson1Client lesson={lesson} step={step} />
    : step.exerciseSet === "section-1-unit-2-group-1-lesson-2"
    ? <Section1Unit2Lesson2Client lesson={lesson} step={step} />
    : step.exerciseSet in LESSON_EXERCISE_SETS
    ? <PairLettersLesson lesson={lesson} step={step as UnitLessonStep & { exerciseSet: ExerciseSetId }} />
    : null;
  return exercise ? <LearningSession key={step.id} lesson={lesson} step={step}>{exercise}</LearningSession> : <GenericLesson lesson={lesson} />;
}
