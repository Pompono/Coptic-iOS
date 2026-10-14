"use client";

import { LESSON_THEME } from "@/lib/lessonTheme";

import Link from "@/lib/AppLink";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { audioService, reportAudioFailure } from "@/lib/audioService";
import { resolveLessonAudio } from "../../../lib/lessonAudio";
import { clearStepFailed, markStepCompleted, markStepFailed } from "../progress";
import { type Lesson, type UnitLessonStep } from "../../../lib/lesson";

type ImageChoice = {
  id: string;
  label: string;
  art: "man" | "water" | "big" | "rice" | "bread";
};

type LessonQuestion =
  | {
      id: string;
      kind: "sound_mcq";
      prompt: string;
      text: string;
      choices: string[];
      answer: string;
      audioId: string;
    }
  | {
      id: string;
      kind: "letter_mcq";
      prompt: string;
      sound: string;
      choices: string[];
      answer: string;
      audioId: string;
    }
  | {
      id: string;
      kind: "listening_mcq";
      prompt: string;
      audio: string;
      choices: string[];
      answer: string;
      audioId: string;
    }
  | {
      id: string;
      kind: "image_vocab";
      prompt: string;
      text: string;
      meaning: string;
      choices: ImageChoice[];
      answer: string;
      audioId: string;
      newWord: true;
    }
  | {
      id: string;
      kind: "translate";
      prompt: string;
      text: string;
      answer: string;
      acceptedAnswers?: string[];
      audioId: string;
      newWord: true;
    }
  | {
      id: string;
      kind: "word_bank";
      prompt: string;
      text: string;
      choices: string[];
      answer: string;
      audioId: string;
      newWord: true;
    }
  | {
      id: string;
      kind: "breakdown";
      prompt: string;
      text: string;
      mapping: Array<{ coptic: string; meaning: string }>;
      audioId: string;
      newWord: true;
    }
  | {
      id: string;
      kind: "meaning_mcq";
      prompt: string;
      text: string;
      choices: string[];
      answer: string;
      audioId: string;
      newWord: true;
    };

const COPTIC = {
  ma: "\u2C99\u2C81",
  me: "\u2C99\u2C89",
  mi: "\u2C99\u2C93",
  mo: "\u2C99\u2C9F",
  na: "\u2C9B\u2C81",
  ro: "\u2CA3\u2C9F",
  ra: "\u2CA3\u2C81",
  ri: "\u2CA3\u2C93",
  re: "\u2CA3\u2C89",
  pi: "\u2CA1\u2C93",
  pa: "\u2CA1\u2C81",
  po: "\u2CA1\u2C9F",
  piromi: "\u2CA1\u2C93\u2CA3\u2CB1\u2C99\u2C93",
  pimoou: "\u2CA1\u2C93\u2C99\u2CB1\u2C9F\u2CA9",
  the: "\u2CA1\u2C93",
  water: "\u2C99\u2CB1\u2C9F\u2CA9",
  mina: "\u2C98\u2C8F\u2C9B\u2C81",
  markos: "\u2C98\u2C81\u2CA3\u2C95\u2C9F\u2CA5",
} as const;

const ART: Record<ImageChoice["art"], string> = {
  man: "\uD83D\uDC68",
  water: "\uD83D\uDCA7",
  big: "\uD83D\uDC18",
  rice: "\uD83C\uDF5A",
  bread: "\uD83C\uDF5E",
};

const SUCCESS_MESSAGES = ["Awesome!", "Excellent!", "Nice!", "Well done!", "Perfect!"] as const;



const QUESTIONS: LessonQuestion[] = [
  {
    id: "u2l1-1",
    kind: "sound_mcq",
    prompt: "What sound does this make?",
    text: COPTIC.ma,
    choices: ["ma", "na", "mo"],
    answer: "ma",
    audioId: "ma",
  },
  {
    id: "u2l1-2",
    kind: "letter_mcq",
    prompt: 'Select the correct letters for "ma"',
    sound: "ma",
    choices: [COPTIC.me, COPTIC.na, COPTIC.ma, COPTIC.mo],
    answer: COPTIC.ma,
    audioId: "ma",
  },
  {
    id: "u2l1-3",
    kind: "listening_mcq",
    prompt: "What do you hear?",
    audio: COPTIC.ma,
    choices: [COPTIC.mo, COPTIC.ma, COPTIC.na, COPTIC.me],
    answer: COPTIC.ma,
    audioId: "ma",
  },
  {
    id: "u2l1-4",
    kind: "sound_mcq",
    prompt: "What sound does this make?",
    text: COPTIC.ro,
    choices: ["ri", "ra", "ro"],
    answer: "ro",
    audioId: COPTIC.ro,
  },
  {
    id: "u2l1-5",
    kind: "letter_mcq",
    prompt: 'Select the correct letters for "ro"',
    sound: "ro",
    choices: [COPTIC.ra, COPTIC.ri, COPTIC.ro, COPTIC.re],
    answer: COPTIC.ro,
    audioId: COPTIC.ro,
  },
  {
    id: "u2l1-6",
    kind: "listening_mcq",
    prompt: "What do you hear?",
    audio: COPTIC.ro,
    choices: [COPTIC.ra, COPTIC.ri, COPTIC.ro, COPTIC.mo],
    answer: COPTIC.ro,
    audioId: COPTIC.ro,
  },
  {
    id: "u2l1-7",
    kind: "sound_mcq",
    prompt: "What sound does this make?",
    text: COPTIC.mi,
    choices: ["mi", "ma", "mo"],
    answer: "mi",
    audioId: COPTIC.mi,
  },
  {
    id: "u2l1-8",
    kind: "letter_mcq",
    prompt: 'Select the correct letters for "mi"',
    sound: "mi",
    choices: [COPTIC.mi, COPTIC.ma, COPTIC.pi, COPTIC.ri],
    answer: COPTIC.mi,
    audioId: COPTIC.mi,
  },
  {
    id: "u2l1-9",
    kind: "sound_mcq",
    prompt: "What sound does this make?",
    text: COPTIC.pi,
    choices: ["pi", "pa", "po"],
    answer: "pi",
    audioId: COPTIC.pi,
  },
  {
    id: "u2l1-10",
    kind: "letter_mcq",
    prompt: 'Select the correct letters for "pi"',
    sound: "pi",
    choices: [COPTIC.pa, COPTIC.po, COPTIC.pi, COPTIC.mi],
    answer: COPTIC.pi,
    audioId: COPTIC.pi,
  },
  {
    id: "u2l1-11",
    kind: "image_vocab",
    prompt: "Select the correct image",
    text: COPTIC.piromi,
    meaning: "the man",
    choices: [
      { id: "the man", label: "the man", art: "man" },
      { id: "the water", label: "the water", art: "water" },
      { id: "big", label: "big", art: "big" },
      { id: "the rice", label: "the rice", art: "rice" },
    ],
    answer: "the man",
    audioId: COPTIC.piromi,
    newWord: true,
  },
  {
    id: "u2l1-12",
    kind: "image_vocab",
    prompt: "Select the correct image",
    text: COPTIC.pimoou,
    meaning: "the water",
    choices: [
      { id: "big", label: "big", art: "big" },
      { id: "the rice", label: "the rice", art: "rice" },
      { id: "the water", label: "the water", art: "water" },
      { id: "the bread", label: "the bread", art: "bread" },
    ],
    answer: "the water",
    audioId: COPTIC.pimoou,
    newWord: true,
  },
  {
    id: "u2l1-13",
    kind: "translate",
    prompt: "Translate this sentence",
    text: COPTIC.mina,
    answer: "Mina",
    audioId: COPTIC.mina,
    newWord: true,
  },
  {
    id: "u2l1-14",
    kind: "translate",
    prompt: "Translate this sentence",
    text: COPTIC.markos,
    answer: "Markos",
    acceptedAnswers: ["Markos", "markos", "Mark", "mark"],
    audioId: COPTIC.markos,
    newWord: true,
  },
  {
    id: "u2l1-15",
    kind: "word_bank",
    prompt: "Translate this sentence",
    text: COPTIC.pimoou,
    choices: ["the", "water", "rice", "and"],
    answer: "the water",
    audioId: COPTIC.pimoou,
    newWord: true,
  },
  {
    id: "u2l1-17",
    kind: "meaning_mcq",
    prompt: "What does this mean?",
    text: COPTIC.piromi,
    choices: ["the man", "the water", "rice", "big"],
    answer: "the man",
    audioId: COPTIC.piromi,
    newWord: true,
  },
  {
    id: "u2l1-18",
    kind: "meaning_mcq",
    prompt: "What does this mean?",
    text: COPTIC.pimoou,
    choices: ["the water", "the man", "rice", "yes"],
    answer: "the water",
    audioId: COPTIC.pimoou,
    newWord: true,
  },
];

function containsCoptic(text: string) {
  return /[\u2C80-\u2CFF\u03E2-\u03EF]/.test(text);
}

function normalizeAnswer(input: string) {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
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

function getQuestionAudioId(question: LessonQuestion) {
  return question.audioId;
}

function getQuestionDisplay(question: LessonQuestion) {
  switch (question.kind) {
    case "sound_mcq":
      return question.text;
    case "letter_mcq":
      return question.sound;
    case "listening_mcq":
      return question.audio;
    case "image_vocab":
    case "translate":
    case "word_bank":
    case "breakdown":
    case "meaning_mcq":
      return question.text;
  }
}

function getExpectedAnswer(question: LessonQuestion) {
  if (question.kind === "breakdown") {
    return question.mapping.map((entry) => `${entry.coptic} = ${entry.meaning}`).join(" | ");
  }

  if (question.kind === "translate" && question.acceptedAnswers?.length) {
    return question.acceptedAnswers.join(" / ");
  }

  return question.answer;
}

function IconSpeaker({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14 3.2a1 1 0 0 1 1.7.7v16.2a1 1 0 0 1-1.7.7L8.7 15H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h3.7L14 3.2Zm4.8 3.5a1 1 0 0 1 1.4.1 8.1 8.1 0 0 1 0 10.4 1 1 0 0 1-1.5-1.3 6.1 6.1 0 0 0 0-7.8 1 1 0 0 1 .1-1.4Zm-2.9 2.2a1 1 0 0 1 1.4.1 4.5 4.5 0 0 1 0 6 1 1 0 0 1-1.5-1.3 2.5 2.5 0 0 0 0-3.4 1 1 0 0 1 .1-1.4Z"
      />
    </svg>
  );
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
  const outcomeRingBorder = "rgba(43, 65, 96, 0.14)";
  const outcomeOuterBackground =
    "radial-gradient(circle at center, rgba(255, 255, 255, 0.38), rgba(255, 255, 255, 0) 70%), linear-gradient(180deg, rgba(235, 230, 218, 0.92) 0%, rgba(221, 214, 198, 0.72) 100%)";
  const outcomeInnerBorder = "rgba(43, 65, 96, 0.08)";
  const outcomeCoreBackground = "linear-gradient(180deg, #40597a 0%, #2b4160 100%)";
  const outcomeCoreShadow =
    "inset 0 -8px 0 rgba(20, 32, 48, 0.24), 0 8px 18px rgba(43, 65, 96, 0.12)";
  const outcomeKickerColor = "rgba(43, 65, 96, 0.62)";
  const outcomeSubtitleColor = "rgba(43, 65, 96, 0.62)";

  return (
    <>
      <main className="lesson-outcome-screen">
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

export default function Section1Unit2Lesson1Client({
  lesson,
  step,
}: {
  lesson: Lesson;
  step: UnitLessonStep;
}) {
  const router = useRouter();
  const audioUnlockedRef = useRef(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 900 });
  const [index, setIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [resultState, setResultState] = useState<"idle" | "correct" | "wrong">("idle");
  const [successMessage, setSuccessMessage] = useState<string>(SUCCESS_MESSAGES[0]);
  const [isComplete, setIsComplete] = useState(false);

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
  const footerShellMinHeight = compactPhone ? (tinyPhone ? 66 : ultraCompactPhone ? 114 : 124) : 156;
  const promptRowHeight = compactPhone ? (tinyPhone ? 56 : ultraCompactPhone ? 70 : 82) : 116;
  const slidePanelGap = compactPhone ? (tinyPhone ? 12 : ultraCompactPhone ? 14 : 16) : 20;
  const desktopSlideViewportHeight = 520;
  const imageChoiceMinHeight = compactPhone ? (tinyPhone ? 126 : ultraCompactPhone ? 142 : 150) : 236;
  const imageArtSize = compactPhone ? (tinyPhone ? 44 : ultraCompactPhone ? 50 : 56) : 72;
  const imageLabelFontSize = compactPhone ? (tinyPhone ? 14 : 16) : 20;
  const progress = Math.max(0.08, index / QUESTIONS.length);
  const stageUsesTwoColumn =
    desktopLayout &&
    (question.kind === "sound_mcq" ||
      question.kind === "letter_mcq" ||
      question.kind === "listening_mcq" ||
      question.kind === "image_vocab" ||
      question.kind === "meaning_mcq" ||
      question.kind === "word_bank" ||
      question.kind === "translate");

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
      case "image_vocab":
      case "meaning_mcq":
        return Boolean(selectedChoice);
      case "translate":
        return typedAnswer.trim().length > 0;
      case "word_bank":
        return selectedWords.length > 0;
      case "breakdown":
        return true;
    }
  }, [question, resultState, selectedChoice, selectedWords.length, typedAnswer]);

  useEffect(() => {
    if (question.kind !== "listening_mcq") {
      return;
    }

    const timer = window.setTimeout(() => {
      unlockAudio();
      playLessonAudio(step.id, questionAudioId, questionDisplay);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [question.kind, questionAudioId, questionDisplay, step.id]);

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

  const playCurrentAudio = () => {
    unlockAudio();
    playLessonAudio(step.id, questionAudioId, questionDisplay);
  };

  const nextQuestion = () => {
    if (index >= QUESTIONS.length - 1) {
      setIsComplete(true);
      return;
    }

    setIndex((current) => current + 1);
    setSelectedChoice(null);
    setTypedAnswer("");
    setSelectedWords([]);
    setResultState("idle");
  };

  const onCheck = () => {
    if (question.kind === "breakdown") {
      nextQuestion();
      return;
    }

    let correct = false;

    switch (question.kind) {
      case "sound_mcq":
      case "letter_mcq":
      case "listening_mcq":
      case "image_vocab":
      case "meaning_mcq":
        correct = selectedChoice === question.answer;
        break;
      case "translate":
        correct = (question.acceptedAnswers ?? [question.answer]).some(
          (answer) => normalizeAnswer(typedAnswer) === normalizeAnswer(answer)
        );
        break;
      case "word_bank":
        correct = normalizeAnswer(selectedWords.join(" ")) === normalizeAnswer(question.answer);
        break;
    }

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
      question.kind === "letter_mcq"
        ? question.sound
        : question.kind === "listening_mcq"
          ? null
          : question.text;
    const labelIsCoptic = label ? containsCoptic(label) : false;

    return (
      <button
        type="button"
        className="lesson-tap-target lesson-audio-card"
        onClick={playCurrentAudio}
        style={{
          width: "100%",
          maxWidth: desktopLayout ? 420 : 380,
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
          padding: compactPhone ? 18 : 26,
          cursor: "pointer",
          textAlign: "center",
          transform: "translateY(0)",
          transition: "transform 150ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 150ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {label ? (
          <span
            className={labelIsCoptic ? "coptic-text" : undefined}
            style={{
              fontSize: labelIsCoptic ? cardLabelFontSize : compactPhone ? 54 : 68,
              lineHeight: 1,
              fontWeight: 700,
              letterSpacing: labelIsCoptic ? 0 : "-0.02em",
            }}
          >
            {label}
          </span>
        ) : (
          <span style={{ transform: `scale(${compactPhone ? 1.3 : 1.55})` }}>
            <IconSpeaker size={compactPhone ? 34 : 38} />
          </span>
        )}

        <span
          style={{
            position: "absolute",
            right: compactPhone ? 16 : 22,
            bottom: compactPhone ? 14 : 18,
          }}
        >
          <IconSpeaker size={compactPhone ? 26 : 32} />
        </span>
      </button>
    );
  };

  const renderChoiceButton = (choice: string) => {
    const isSelected = selectedChoice === choice;
    const isCorrect = resultState !== "idle" && question.kind !== "breakdown" && choice === question.answer;
    const isWrong =
      resultState === "wrong" && question.kind !== "breakdown" && isSelected && choice !== question.answer;

    return (
      <button
        key={choice}
        type="button"
        className="lesson-tap-target lesson-choice-button"
        disabled={resultState !== "idle"}
        onClick={() => setSelectedChoice(choice)}
        style={{
          minHeight: choiceMinHeight,
          borderRadius: compactPhone ? 22 : 28,
          border: `3px solid ${
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
          padding: compactPhone ? 14 : 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontSize: choiceTextFontSize,
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

  const renderInteraction = () => {
    if (
      question.kind === "sound_mcq" ||
      question.kind === "letter_mcq" ||
      question.kind === "listening_mcq" ||
      question.kind === "meaning_mcq"
    ) {
      const singleColumn = question.kind === "sound_mcq" && question.choices.length <= 3;

      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: singleColumn ? "1fr" : "repeat(2, minmax(0, 1fr))",
            gap: compactPhone ? 12 : 18,
            alignContent: "start",
          }}
        >
          {question.choices.map((choice) => renderChoiceButton(choice))}
        </div>
      );
    }

    if (question.kind === "image_vocab") {
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: gridGap,
            alignContent: "start",
          }}
        >
          {question.choices.map((choice) => {
            const isSelected = selectedChoice === choice.id;
            const isCorrect = resultState !== "idle" && choice.id === question.answer;
            const isWrong = resultState === "wrong" && isSelected && choice.id !== question.answer;

            return (
              <button
                key={choice.id}
                type="button"
                className="lesson-tap-target lesson-choice-button"
                disabled={resultState !== "idle"}
                onClick={() => setSelectedChoice(choice.id)}
                style={{
                  minHeight: imageChoiceMinHeight,
                  borderRadius: compactPhone ? 22 : 28,
                  border: `3px solid ${
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
                    : isWrong
                      ? LESSON_THEME.choiceWrongBg
                      : isSelected
                        ? LESSON_THEME.choiceSelectedBg
                        : LESSON_THEME.choiceBg,
                  padding: compactPhone ? 12 : 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: compactPhone ? 10 : 12,
                  cursor: resultState === "idle" ? "pointer" : "default",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    minHeight: compactPhone ? (tinyPhone ? 72 : ultraCompactPhone ? 82 : 92) : 142,
                    borderRadius: 20,
                    background: "var(--lesson-input-bg)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: imageArtSize,
                  }}
                >
                  {ART[choice.art]}
                </div>
                <div
                  style={{
                    fontSize: imageLabelFontSize,
                    lineHeight: 1.15,
                    fontWeight: 700,
                    color: isCorrect
                      ? LESSON_THEME.choiceCorrectText
                      : isWrong
                        ? LESSON_THEME.choiceWrongText
                        : isSelected
                          ? LESSON_THEME.choiceSelectedText
                          : LESSON_THEME.textPrimary,
                    textAlign: "center",
                  }}
                >
                  {choice.label}
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (question.kind === "translate") {
      return (
        <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
          <input
            type="text"
            value={typedAnswer}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={resultState !== "idle"}
            placeholder="Type the translation"
            onChange={(event) => setTypedAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onPrimaryAction();
              }
            }}
            style={{
              width: "100%",
              minHeight: compactPhone ? 64 : 72,
              borderRadius: compactPhone ? 18 : 22,
              border: `2px solid ${LESSON_THEME.inputBorder}`,
              background: LESSON_THEME.inputBg,
              color: LESSON_THEME.textPrimary,
              padding: compactPhone ? "16px 18px" : "18px 20px",
              fontSize: compactPhone ? 22 : 24,
              fontWeight: 600,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
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

    if (question.kind === "breakdown") {
      return (
        <div style={{ display: "grid", gap: compactPhone ? 12 : 14, alignContent: "start" }}>
          {question.mapping.map((entry) => (
            <div
              key={entry.coptic}
              style={{
                display: "grid",
                gridTemplateColumns: compactPhone ? "1fr" : "minmax(0, auto) 48px minmax(0, 1fr)",
                alignItems: "center",
                gap: compactPhone ? 8 : 14,
                borderRadius: compactPhone ? 20 : 24,
                border: `1px solid ${LESSON_THEME.choiceBorder}`,
                background: LESSON_THEME.choiceBg,
                padding: compactPhone ? "16px 18px" : "18px 20px",
              }}
            >
              <span
                className="coptic-text"
                style={{
                  fontSize: compactPhone ? 28 : 32,
                  lineHeight: 1,
                  fontWeight: 700,
                  color: LESSON_THEME.textPrimary,
                }}
              >
                {entry.coptic}
              </span>
              <span
                style={{
                  height: 3,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${LESSON_THEME.progressStart} 0%, ${LESSON_THEME.progressEnd} 100%)`,
                  display: compactPhone ? "none" : "block",
                }}
              />
              <span
                style={{
                  fontSize: compactPhone ? 20 : 22,
                  lineHeight: 1.2,
                  fontWeight: 700,
                  color: LESSON_THEME.textPrimary,
                }}
              >
                {entry.meaning}
              </span>
            </div>
          ))}
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
                  : `${promptRowHeight}px ${cardMinHeight}px minmax(0, 1fr)`,
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
                    margin: 0,
                    fontSize: titleFontSize,
                    lineHeight: 1.08,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    color: LESSON_THEME.textPrimary,
                    maxWidth: desktopLayout ? "18ch" : undefined,
                  }}
                >
                  {question.prompt}
                </h1>
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
                  <div style={{ display: "flex", justifyContent: "center", minHeight: 0 }}>{renderAudioCard()}</div>
                  <div
                    className="lesson-scroll-panel"
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
                  <div style={{ display: "flex", justifyContent: "center", minHeight: 0 }}>{renderAudioCard()}</div>
                  <div
                    className="lesson-scroll-panel"
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
                : question.kind === "breakdown"
                  ? "Continue"
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
