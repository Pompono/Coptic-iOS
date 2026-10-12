"use client";

import Link from "@/lib/AppLink";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { audioService } from "@/lib/audioService";
import { resolveLessonAudio } from "../../../lib/lessonAudio";
import { clearStepFailed, markStepCompleted, markStepFailed } from "../progress";
import { type ExerciseSetId, type Lesson, type UnitLessonStep } from "../../../lib/lesson";
import Section1Unit2Lesson1Client from "./Section1Unit2Lesson1Client";
import Section1Unit2Lesson2Client from "./Section1Unit2Lesson2Client";

type PairLettersExercise =
  | {
      id: string;
      kind: "sound-to-roman";
      prompt: string;
      display: string;
      choices: string[];
      answer: string;
      audioId: string;
    }
  | {
      id: string;
      kind: "roman-to-coptic";
      prompt: string;
      display: string;
      choices: string[];
      answer: string;
      audioId?: string;
    }
  | {
      id: string;
      kind: "hear-and-choose";
      prompt: string;
      choices: string[];
      answer: string;
      audioId: string;
    }
  | {
      id: string;
      kind: "matching-pairs";
      prompt: string;
      pairs: Array<{
        left: string;
        right: string;
      }>;
    };

type MatchingTileSelection = {
  side: "left" | "right";
  value: string;
};

type MatchingExerciseLayout = {
  leftChoices: string[];
  rightChoices: string[];
};

type ChoiceExerciseLayout = string[];

const A_O_D_LETTERS_EXERCISES: PairLettersExercise[] = [
  {
    id: "1011",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "a"',
    display: "a",
    choices: ["\u2C87\u2C81", "\u2C87", "\u2C9F", "\u2C81"],
    answer: "\u2C81",
    audioId: "a",
  },
  {
    id: "1012",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["o", "dhad", "a", "d"],
    answer: "a",
    audioId: "a",
  },
  {
    id: "1013",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C81",
    choices: ["o", "a", "d"],
    answer: "a",
    audioId: "a",
  },
  {
    id: "1014",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["d", "dha", "o", "dhad"],
    answer: "dha",
    audioId: "dha",
  },
  {
    id: "1015",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C87\u2C81",
    choices: ["dho", "dha", "dhad"],
    answer: "dha",
    audioId: "dha",
  },
  {
    id: "1016",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "dha"',
    display: "dha",
    choices: ["\u2C87\u2C81\u2C87", "\u2C87", "\u2C87\u2C9F", "\u2C87\u2C81"],
    answer: "\u2C87\u2C81",
    audioId: "dha",
  },
  {
    id: "1017",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["o", "dho", "dhad", "dhod"],
    answer: "o",
    audioId: "o",
  },
  {
    id: "1018",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9F",
    choices: ["a", "d", "o"],
    answer: "o",
    audioId: "o",
  },
  {
    id: "1019",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "o"',
    display: "o",
    choices: ["\u2C81", "\u2C87\u2C9F", "\u2C9F", "\u2C87"],
    answer: "\u2C9F",
    audioId: "o",
  },
  {
    id: "1020",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["o", "dha", "dho", "d"],
    answer: "dho",
    audioId: "dho",
  },
  {
    id: "1021",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "dho"',
    display: "dho",
    choices: ["\u2C87\u2C9F", "\u2C87\u2C81", "\u2C87\u2C9F\u2C87", "\u2C87\u2C81\u2C87"],
    answer: "\u2C87\u2C9F",
    audioId: "dho",
  },
  {
    id: "1022",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C87\u2C81\u2C87",
    choices: ["dhod", "dha", "dhad"],
    answer: "dhad",
    audioId: "dhad",
  },
  {
    id: "1023",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C87\u2C9F",
    choices: ["o", "dho", "dhod"],
    answer: "dho",
    audioId: "dho",
  },
  {
    id: "1024",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "dhad"',
    display: "dhad",
    choices: ["\u2C9F", "\u2C87\u2C81", "\u2C87\u2C81\u2C87", "\u2C87\u2C9F\u2C87"],
    answer: "\u2C87\u2C81\u2C87",
    audioId: "dhad",
  },
  {
    id: "1025",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C87\u2C9F\u2C87",
    choices: ["dhod", "dha", "dhad"],
    answer: "dhod",
    audioId: "dhod",
  },
  {
    id: "1026",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["dho", "d", "dhod", "dhad"],
    answer: "dhod",
    audioId: "dhod",
  },
  {
    id: "1027",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "dhod"',
    display: "dhod",
    choices: ["\u2C87", "\u2C87\u2C81\u2C87", "\u2C87\u2C9F\u2C87", "\u2C87\u2C9F"],
    answer: "\u2C87\u2C9F\u2C87",
    audioId: "dhod",
  },
  {
    id: "1028",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["dha", "a", "dhad", "dhod"],
    answer: "dhad",
    audioId: "dhad",
  },
  {
    id: "1029",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C87\u2C81",
    choices: ["dha", "dhad", "o"],
    answer: "dha",
    audioId: "dha",
  },
];

const PAIR_LETTERS_EXERCISES: PairLettersExercise[] = [
  {
    id: "za-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲍⲁ",
    choices: ["dhad", "za", "zu"],
    answer: "za",
    audioId: "za",
  },
  {
    id: "za-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "za"',
    display: "za",
    choices: ["ⲍⲓ", "ⲍⲟⲩ", "ⲍⲁ", "ⲍ"],
    answer: "ⲍⲁ",
    audioId: "za",
  },
  {
    id: "dhi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲇⲓ",
    choices: ["zi", "du", "dhi"],
    answer: "dhi",
    audioId: "dhi",
  },
  {
    id: "dhi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "dhi"',
    display: "dhi",
    choices: ["ⲇⲓ", "ⲍⲁ", "ⲓ", "ⲍⲟⲩ"],
    answer: "ⲇⲓ",
    audioId: "dhi",
  },
  {
    id: "dhi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["za", "dhi", "zu", "i"],
    answer: "dhi",
    audioId: "dhi",
  },
  {
    id: "i-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "i"',
    display: "i",
    choices: ["ⲍⲁ", "ⲍⲟⲩ", "ⲓ", "ⲇⲓ"],
    answer: "ⲓ",
    audioId: "i",
  },
  {
    id: "i-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲓ",
    choices: ["i", "u", "a"],
    answer: "i",
    audioId: "i",
  },
  {
    id: "zod-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲍⲟⲇ",
    choices: ["zad", "duz", "zod"],
    answer: "zod",
    audioId: "zod",
  },
  {
    id: "zod-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "zod"',
    display: "zod",
    choices: ["ⲍ", "ⲍⲟ", "ⲍⲓ", "ⲍⲟⲇ"],
    answer: "ⲍⲟⲇ",
    audioId: "zod",
  },
  {
    id: "za-sound-2",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲍⲁ",
    choices: ["za", "du", "dha"],
    answer: "za",
    audioId: "za",
  },
  {
    id: "za-letter-2",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "za"',
    display: "za",
    choices: ["ⲍⲟⲇ", "ⲍ", "ⲍⲁ", "ⲍⲓ"],
    answer: "ⲍⲁ",
    audioId: "za",
  },
  {
    id: "zi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "zi"',
    display: "zi",
    choices: ["ⲍⲓ", "ⲍⲟⲇ", "ⲓ", "ⲍⲟ"],
    answer: "ⲍⲓ",
    audioId: "zi",
  },
  {
    id: "zi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["za", "zi", "zu", "i"],
    answer: "zi",
    audioId: "zi",
  },
  {
    id: "zi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲍⲓ",
    choices: ["dhi", "zi", "zu"],
    answer: "zi",
    audioId: "zi",
  },
  {
    id: "zod-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["za", "zod", "zi", "dhi"],
    answer: "zod",
    audioId: "zod",
  },
];

const R_LETTERS_EXERCISES: PairLettersExercise[] = [
  {
    id: "rod-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲣⲟⲇ",
    choices: ["rud", "za", "rod"],
    answer: "rod",
    audioId: "rod",
  },
  {
    id: "rod-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "rod"',
    display: "rod",
    choices: ["ⲣⲓ", "ⲣⲟⲇ", "ⲇⲟⲣ", "ⲣⲟ"],
    answer: "ⲣⲟⲇ",
    audioId: "rod",
  },
  {
    id: "ri-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲣⲓ",
    choices: ["ri", "ru", "du"],
    answer: "ri",
    audioId: "ri",
  },
  {
    id: "ri-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ri"',
    display: "ri",
    choices: ["ⲣⲓ", "ⲣⲟⲇ", "ⲍⲟⲇ", "ⲇⲁ"],
    answer: "ⲣⲓ",
    audioId: "ri",
  },
  {
    id: "ra-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲣⲁ",
    choices: ["dha", "za", "ra"],
    answer: "ra",
    audioId: "ra",
  },
  {
    id: "ra-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ra"',
    display: "ra",
    choices: ["ⲣⲁ", "ⲣⲟ", "ⲇⲟⲣ", "ⲍⲓ"],
    answer: "ⲣⲁ",
    audioId: "ra",
  },
  {
    id: "rod-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["rod", "ri", "za", "ra"],
    answer: "rod",
    audioId: "rod",
  },
  {
    id: "zar-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲍⲁⲣ",
    choices: ["zir", "dur", "zar"],
    answer: "zar",
    audioId: "zar",
  },
  {
    id: "zar-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "zar"',
    display: "zar",
    choices: ["ⲣⲁ", "ⲇⲟⲣ", "ⲍⲓ", "ⲍⲁⲣ"],
    answer: "ⲍⲁⲣ",
    audioId: "zar",
  },
  {
    id: "ri-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ri", "ru", "du"],
    answer: "ri",
    audioId: "ri",
  },
  {
    id: "ra-sound-2",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲣⲁ",
    choices: ["za", "u", "ra"],
    answer: "ra",
    audioId: "ra",
  },
  {
    id: "ra-letter-2",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ra"',
    display: "ra",
    choices: ["ⲣⲁ", "ⲣⲟ", "ⲍⲓ", "ⲣⲟⲇ"],
    answer: "ⲣⲁ",
    audioId: "ra",
  },
  {
    id: "zar-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["zar", "rod", "ra", "ri"],
    answer: "zar",
    audioId: "zar",
  },
  {
    id: "rod-sound-2",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ⲣⲟⲇ",
    choices: ["rod", "rar", "ri"],
    answer: "rod",
    audioId: "rod",
  },
  {
    id: "zar-letter-2",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "zar"',
    display: "zar",
    choices: ["ⲣⲁ", "ⲇⲟⲣ", "ⲍⲓ", "ⲍⲁⲣ"],
    answer: "ⲍⲁⲣ",
    audioId: "zar",
  },
];

const W_Y_SEMIVOWEL_EXERCISES: PairLettersExercise[] = [
  {
    id: "oowa-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9F\u2CA9\u2C81",
    choices: ["ouwa", "a", "ou"],
    answer: "ouwa",
    audioId: "ouwa",
  },
  {
    id: "oo-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ouwa", "ou", "rav", "ouwi"],
    answer: "ou",
    audioId: "ou",
  },
  {
    id: "oowa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ouwa"',
    display: "ouwa",
    choices: ["\u2C9F\u2CA9\u2C81", "\u2C9F\u2CA9", "\u2CA3\u2C81", "\u2C93\u2C81"],
    answer: "\u2C9F\u2CA9\u2C81",
    audioId: "ouwa",
  },
  {
    id: "raaw-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA3\u2C81\u2CA9",
    choices: ["rav", "rii", "rai"],
    answer: "rav",
    audioId: "rav",
  },
  {
    id: "raaw-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ouwa", "rav", "ou", "ya"],
    answer: "rav",
    audioId: "rav",
  },
  {
    id: "raaw-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "rav"',
    display: "rav",
    choices: ["\u2CA3\u2C81\u2C93", "\u2CA3\u2C81\u2CA9", "\u2C9F\u2CA9\u2C81", "\u2CA3\u2C81"],
    answer: "\u2CA3\u2C81\u2CA9",
    audioId: "rav",
  },
  {
    id: "ya-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C93\u2C81",
    choices: ["ya", "ii", "ouwa"],
    answer: "ya",
    audioId: "ya",
  },
  {
    id: "ya-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ya", "ouwa", "ou", "rai"],
    answer: "ya",
    audioId: "ya",
  },
  {
    id: "ya-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ya"',
    display: "ya",
    choices: ["\u2C93\u2C81", "\u2CA3\u2C81\u2CA9", "\u2C9F\u2CA9\u2C81", "\u2CA3\u2C81\u2C93"],
    answer: "\u2C93\u2C81",
    audioId: "ya",
  },
  {
    id: "raay-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA3\u2C81\u2C93",
    choices: ["rav", "rii", "rai"],
    answer: "rai",
    audioId: "rai",
  },
  {
    id: "raay-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ouwa", "rai", "ya", "rav"],
    answer: "rai",
    audioId: "rai",
  },
  {
    id: "raay-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "rai"',
    display: "rai",
    choices: ["\u2CA3\u2C81\u2CA9", "\u2C9F\u2CA9\u2C93", "\u2CA3\u2C81\u2C93", "\u2CA3\u2C81"],
    answer: "\u2CA3\u2C81\u2C93",
    audioId: "rai",
  },
  {
    id: "wii-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9F\u2CA9\u2C93",
    choices: ["ya", "ii", "ouwi"],
    answer: "ouwi",
    audioId: "ouwi",
  },
  {
    id: "wii-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ya", "ouwa", "ou", "ouwi"],
    answer: "ouwi",
    audioId: "ouwi",
  },
  {
    id: "wii-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ouwi"',
    display: "ouwi",
    choices: ["\u2C9F\u2CA9\u2C93", "\u2C9F\u2CA9", "\u2C93\u2C81", "\u2CA3\u2C81\u2C93"],
    answer: "\u2C9F\u2CA9\u2C93",
    audioId: "ouwi",
  },
  {
    id: "oo-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9F\u2CA9",
    choices: ["ouwa", "ou", "ouwi"],
    answer: "ou",
    audioId: "ou",
  },
];

const ARABIC_COPTIC_BRIDGE_EXERCISES: PairLettersExercise[] = [
  {
    id: "bridge-a-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "a"',
    display: "a",
    choices: ["\u2C87", "\u2C81", "\u2C9F\u2CA9", "\u2C87\u2C81"],
    answer: "\u2C81",
    audioId: "a",
  },
  {
    id: "bridge-foundation-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C81", right: "a" },
      { left: "\u2C87\u2C81", right: "dha" },
      { left: "\u2C87\u2C81\u2C87", right: "dhad" },
      { left: "\u2C87\u2C9F\u2CA9", right: "dhou" },
      { left: "\u2C87\u2C9F\u2CA9\u2C87", right: "dhoud" },
    ],
  },
  {
    id: "bridge-ou-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9F\u2CA9",
    choices: ["a", "ou", "dha"],
    answer: "ou",
    audioId: "ou",
  },
  {
    id: "bridge-ouwa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ouwi", "ouwa", "ou", "ya"],
    answer: "ouwa",
    audioId: "ouwa",
  },
  {
    id: "bridge-dhoud-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C87\u2C9F\u2CA9\u2C87",
    choices: ["dha", "dhad", "dhoud"],
    answer: "dhoud",
    audioId: "dhoud",
  },
  {
    id: "bridge-dhoud-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["dha", "dhou", "dhad", "dhoud"],
    answer: "dhoud",
    audioId: "dhoud",
  },
  {
    id: "bridge-dhoud-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "dhoud"',
    display: "dhoud",
    choices: ["\u2C87", "\u2C87\u2C9F\u2CA9\u2C87", "\u2C87\u2C81\u2C87", "\u2C87\u2C9F\u2CA9"],
    answer: "\u2C87\u2C9F\u2CA9\u2C87",
    audioId: "dhoud",
  },
  {
    id: "bridge-dha-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C87\u2C81",
    choices: ["dha", "dhad", "dhou"],
    answer: "dha",
    audioId: "dha",
  },
  {
    id: "bridge-dha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "dha"',
    display: "dha",
    choices: ["\u2C87\u2C81", "\u2C87\u2C81\u2C87", "\u2C81", "\u2C87"],
    answer: "\u2C87\u2C81",
    audioId: "dha",
  },
  {
    id: "bridge-dhad-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "dhad"',
    display: "dhad",
    choices: ["\u2C87\u2C9F\u2CA9\u2C87", "\u2C87\u2C81", "\u2C87\u2C81\u2C87", "\u2C9F\u2CA9"],
    answer: "\u2C87\u2C81\u2C87",
    audioId: "dhad",
  },
  {
    id: "bridge-dhou-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "dhou"',
    display: "dhou",
    choices: ["\u2C9F\u2CA9", "\u2C87\u2C9F\u2CA9", "\u2C87\u2C9F\u2CA9\u2C87", "\u2C87\u2C81"],
    answer: "\u2C87\u2C9F\u2CA9",
    audioId: "dhou",
  },
  {
    id: "bridge-ouwa-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9F\u2CA9\u2C81",
    choices: ["a", "ouwa", "ou"],
    answer: "ouwa",
    audioId: "ouwa",
  },
  {
    id: "bridge-ou-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["a", "ou", "ouwa", "dha"],
    answer: "ou",
    audioId: "ou",
  },
  {
    id: "bridge-semivowel-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C9F\u2CA9", right: "ou" },
      { left: "\u2C9F\u2CA9\u2C81", right: "ouwa" },
      { left: "\u2C9F\u2CA9\u2C93", right: "ouwi" },
      { left: "\u2CA3\u2C81\u2CA9", right: "rav" },
      { left: "\u2CA3\u2C81\u2C93", right: "rai" },
    ],
  },
  {
    id: "bridge-ouwi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ouwi"',
    display: "ouwi",
    choices: ["\u2CA3\u2C81\u2CA9", "\u2C9F\u2CA9\u2C93", "\u2CA3\u2C81\u2C93", "\u2C9F\u2CA9"],
    answer: "\u2C9F\u2CA9\u2C93",
    audioId: "ouwi",
  },
  {
    id: "bridge-rav-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "rav"',
    display: "rav",
    choices: ["\u2C9F\u2CA9\u2C81", "\u2CA3\u2C81\u2CA9", "\u2CA3\u2C81\u2C93", "\u2C93\u2C81"],
    answer: "\u2CA3\u2C81\u2CA9",
    audioId: "rav",
  },
  {
    id: "bridge-rai-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "rai"',
    display: "rai",
    choices: ["\u2CA3\u2C81\u2CA9", "\u2CA3\u2C81\u2C93", "\u2C9F\u2CA9\u2C93", "\u2C9F\u2CA9"],
    answer: "\u2CA3\u2C81\u2C93",
    audioId: "rai",
  },
];

const SECTION_1_UNIT_1_GROUP_1_REVIEW_EXERCISES: PairLettersExercise[] = [
  {
    id: "review-ou-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ou"',
    display: "ou",
    choices: ["\u2C9F\u2CA9\u2C81", "\u2C9F\u2CA9", "\u2CA3\u2C81\u2CA9", "\u2C93\u2C81"],
    answer: "\u2C9F\u2CA9",
    audioId: "ou",
  },
  {
    id: "review-za-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["zi", "za", "ri", "ou"],
    answer: "za",
    audioId: "za",
  },
  {
    id: "review-zar-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["zar", "rod", "rai", "rav"],
    answer: "zar",
    audioId: "zar",
  },
  {
    id: "review-rai-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "rai"',
    display: "rai",
    choices: ["\u2CA3\u2C81\u2CA9", "\u2CA3\u2C81\u2C93", "\u2C9F\u2CA9\u2C93", "\u2CA3\u2C93"],
    answer: "\u2CA3\u2C81\u2C93",
    audioId: "rai",
  },
  {
    id: "review-ra-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA3\u2C81",
    choices: ["ou", "za", "ra"],
    answer: "ra",
    audioId: "ra",
  },
  {
    id: "review-semivowel-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C9F\u2CA9", right: "ou" },
      { left: "\u2CA3\u2C81\u2C93", right: "rai" },
      { left: "\u2C9F\u2CA9\u2C93", right: "ouwi" },
      { left: "\u2CA3\u2C81\u2CA9", right: "rav" },
      { left: "\u2C93\u2C81", right: "ya" },
    ],
  },
  {
    id: "review-foundations-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C8D\u2C81", right: "za" },
      { left: "\u2C8D\u2C93", right: "zi" },
      { left: "\u2CA3\u2C93", right: "ri" },
      { left: "\u2CA3\u2C9F\u2C87", right: "rod" },
      { left: "\u2C8D\u2C81\u2CA3", right: "zar" },
    ],
  },
  {
    id: "review-zar-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "zar"',
    display: "zar",
    choices: ["\u2CA3\u2C81", "\u2C8D\u2C81\u2CA3", "\u2CA3\u2C9F\u2C87", "\u2C8D\u2C93"],
    answer: "\u2C8D\u2C81\u2CA3",
    audioId: "zar",
  },
  {
    id: "review-ri-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA3\u2C93",
    choices: ["ri", "rai", "zi"],
    answer: "ri",
    audioId: "ri",
  },
  {
    id: "review-ouwi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9F\u2CA9\u2C93",
    choices: ["ouwa", "ouwi", "ou"],
    answer: "ouwi",
    audioId: "ouwi",
  },
];

const SECTION_1_UNIT_1_GROUP_2_LESSON_1_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-2-uu-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "ee"',
    display: "ee",
    choices: ["\u2C8F", "\u2C89", "\u2C83\u2C8F", "\u2C95\u2C89"],
    answer: "\u2C8F",
    audioId: "ee",
  },
  {
    id: "group-2-duud-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "vee"',
    display: "vee",
    choices: ["\u2C95\u2C89", "\u2C83\u2C89", "\u2C95\u2C8F", "\u2C83\u2C8F"],
    answer: "\u2C83\u2C8F",
    audioId: "vee",
  },
  {
    id: "group-2-aa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["e", "vee", "ke", "ee"],
    answer: "e",
    audioId: "e",
  },
  {
    id: "group-2-daad-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["kee", "e", "vee", "ve"],
    answer: "ve",
    audioId: "ve",
  },
  {
    id: "group-2-aa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "e"',
    display: "e",
    choices: ["\u2C89", "\u2C8F", "\u2C83\u2C89", "\u2C95\u2C89"],
    answer: "\u2C89",
    audioId: "e",
  },
  {
    id: "group-2-duu-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "kee"',
    display: "kee",
    choices: ["\u2C95\u2C89", "\u2C83\u2C89", "\u2C95\u2C8F", "\u2C83\u2C8F"],
    answer: "\u2C95\u2C8F",
    audioId: "kee",
  },
  {
    id: "group-2-duud-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["kee", "e", "vee", "ke"],
    answer: "vee",
    audioId: "vee",
  },
  {
    id: "group-2-daad-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C83\u2C89", right: "ve" },
      { left: "\u2C83\u2C8F", right: "vee" },
      { left: "\u2C89", right: "e" },
      { left: "\u2C95\u2C8F", right: "kee" },
      { left: "\u2C95\u2C89", right: "ke" },
    ],
  },
  {
    id: "group-2-aa-uu-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C83\u2C89", right: "ve" },
      { left: "\u2C8F", right: "ee" },
      { left: "\u2C89", right: "e" },
      { left: "\u2C95\u2C89", right: "ke" },
      { left: "\u2C95\u2C8F", right: "kee" },
    ],
  },
  {
    id: "group-2-daad-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ke"',
    display: "ke",
    choices: ["\u2C95\u2C89", "\u2C95\u2C8F", "\u2C83\u2C89", "\u2C83\u2C8F"],
    answer: "\u2C95\u2C89",
    audioId: "ke",
  },
  {
    id: "group-2-da-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ee", "vee", "ke", "kee"],
    answer: "ke",
    audioId: "ke",
  },
  {
    id: "group-2-duu-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["kee", "ee", "ke", "ve"],
    answer: "kee",
    audioId: "kee",
  },
  {
    id: "group-2-daa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ve"',
    display: "ve",
    choices: ["\u2C95\u2C89", "\u2C83\u2C89", "\u2C83", "\u2C83\u2C8F"],
    answer: "\u2C83\u2C89",
    audioId: "ve",
  },
  {
    id: "group-2-daa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ve", "vee", "ke", "ee"],
    answer: "ve",
    audioId: "ve",
  },
  {
    id: "group-2-uu-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ee", "kee", "vee", "ve"],
    answer: "ee",
    audioId: "ee",
  },
];

const SECTION_1_UNIT_1_GROUP_2_LESSON_2_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-2-zi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["pa", "i", "pod", "pi"],
    answer: "pi",
    audioId: "pi",
  },
  {
    id: "group-2-za-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["pa", "vi", "po", "pi"],
    answer: "pa",
    audioId: "pa",
  },
  {
    id: "group-2-foundation-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C83\u2C93", right: "vi" },
      { left: "\u2CA1\u2C93", right: "pi" },
      { left: "\u2CA1\u2C9F", right: "po" },
      { left: "\u2CA1\u2C9F\u2C87", right: "pod" },
      { left: "\u2C93", right: "i" },
    ],
  },
  {
    id: "group-2-zo-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["i", "pa", "pi", "po"],
    answer: "po",
    audioId: "po",
  },
  {
    id: "group-2-dhi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "vi"',
    display: "vi",
    choices: ["\u2CA1\u2C81", "\u2C93", "\u2CA1\u2C9F\u2C87", "\u2C83\u2C93"],
    answer: "\u2C83\u2C93",
    audioId: "vi",
  },
  {
    id: "group-2-zi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "pi"',
    display: "pi",
    choices: ["\u2CA1\u2C9F\u2C87", "\u2CA1\u2C93", "\u2C83\u2C93", "\u2C93"],
    answer: "\u2CA1\u2C93",
    audioId: "pi",
  },
  {
    id: "group-2-zod-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "pod"',
    display: "pod",
    choices: ["\u2CA1\u2C9F", "\u2CA1\u2C9F\u2C87", "\u2CA1\u2C81", "\u2CA1\u2C93"],
    answer: "\u2CA1\u2C9F\u2C87",
    audioId: "pod",
  },
  {
    id: "group-2-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C83\u2C93", right: "vi" },
      { left: "\u2CA1\u2C9F", right: "po" },
      { left: "\u2CA1\u2C81", right: "pa" },
      { left: "\u2C93", right: "i" },
      { left: "\u2CA1\u2C93", right: "pi" },
    ],
  },
  {
    id: "group-2-za-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "pa"',
    display: "pa",
    choices: ["\u2CA1\u2C93", "\u2CA1\u2C9F\u2C87", "\u2CA1\u2C81", "\u2C83\u2C93"],
    answer: "\u2CA1\u2C81",
    audioId: "pa",
  },
  {
    id: "group-2-i-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "i"',
    display: "i",
    choices: ["\u2CA1\u2C93", "\u2CA1\u2C9F", "\u2C93", "\u2C83\u2C93"],
    answer: "\u2C93",
    audioId: "i",
  },
  {
    id: "group-2-zo-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "po"',
    display: "po",
    choices: ["\u2CA1\u2C81", "\u2CA1\u2C9F", "\u2CA1\u2C9F\u2C87", "\u2CA1\u2C93"],
    answer: "\u2CA1\u2C9F",
    audioId: "po",
  },
  {
    id: "group-2-dhi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["pa", "vi", "i", "pi"],
    answer: "vi",
    audioId: "vi",
  },
];

const SECTION_1_UNIT_1_GROUP_2_LESSON_3_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-3-vi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["vi", "ti", "mi", "pi"],
    answer: "vi",
    audioId: "vi",
  },
  {
    id: "group-3-ti-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ti"',
    display: "ti",
    choices: ["\u2CA7\u2C93", "\u2C99\u2C93", "\u2C83\u2C93", "\u2CA1\u2C93"],
    answer: "\u2CA7\u2C93",
    audioId: "ti",
  },
  {
    id: "group-3-me-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "me"',
    display: "me",
    choices: ["\u2C99\u2C89", "\u2CA7\u2C89", "\u2C99\u2C93", "\u2C83\u2C89"],
    answer: "\u2C99\u2C89",
    audioId: "me",
  },
  {
    id: "group-3-tee-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["te", "tee", "pi", "mee"],
    answer: "tee",
    audioId: "tee",
  },
  {
    id: "group-3-transition-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2CA7\u2C89", right: "te" },
      { left: "\u2CA7\u2C8F", right: "tee" },
      { left: "\u2C99\u2C89", right: "me" },
      { left: "\u2C99\u2C93", right: "mi" },
      { left: "\u2CA1\u2C93", right: "pi" },
    ],
  },
  {
    id: "group-3-mi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "mi"',
    display: "mi",
    choices: ["\u2C99\u2C93", "\u2CA7\u2C93", "\u2C99\u2C89", "\u2CA7\u2C89"],
    answer: "\u2C99\u2C93",
    audioId: "mi",
  },
  {
    id: "group-3-te-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["me", "pi", "te", "vi"],
    answer: "te",
    audioId: "te",
  },
  {
    id: "group-3-mee-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "mee"',
    display: "mee",
    choices: ["\u2CA7\u2C8F", "\u2C99\u2C8F", "\u2C99\u2C89", "\u2C99\u2C93"],
    answer: "\u2C99\u2C8F",
    audioId: "mee",
  },
  {
    id: "group-3-pi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ti", "mi", "pi", "i"],
    answer: "pi",
    audioId: "pi",
  },
];

const SECTION_1_UNIT_1_GROUP_2_LESSON_4_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-4-la-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["la", "na", "li", "le"],
    answer: "la",
    audioId: "la",
  },
  {
    id: "group-4-ni-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ni"',
    display: "ni",
    choices: ["\u2C9B\u2C93", "\u2C97\u2C93", "\u2CA7\u2C93", "\u2C99\u2C93"],
    answer: "\u2C9B\u2C93",
    audioId: "ni",
  },
  {
    id: "group-4-le-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "le"',
    display: "le",
    choices: ["\u2C97\u2C89", "\u2C97\u2C93", "\u2C9B\u2C89", "\u2CA7\u2C89"],
    answer: "\u2C97\u2C89",
    audioId: "le",
  },
  {
    id: "group-4-na-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["na", "la", "ni", "me"],
    answer: "na",
    audioId: "na",
  },
  {
    id: "group-4-bridge-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C9B\u2C81", right: "na" },
      { left: "\u2C9B\u2C93", right: "ni" },
      { left: "\u2C97\u2C89", right: "le" },
      { left: "\u2C97\u2C93", right: "li" },
      { left: "\u2CA7\u2C89", right: "te" },
    ],
  },
  {
    id: "group-4-li-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "li"',
    display: "li",
    choices: ["\u2C97\u2C93", "\u2C9B\u2C93", "\u2C97\u2C89", "\u2C97\u2C81"],
    answer: "\u2C97\u2C93",
    audioId: "li",
  },
  {
    id: "group-4-ne-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ni", "ne", "me", "le"],
    answer: "ne",
    audioId: "ne",
  },
  {
    id: "group-4-la-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "la"',
    display: "la",
    choices: ["\u2C97\u2C81", "\u2C97\u2C89", "\u2C9B\u2C81", "\u2C9B\u2C93"],
    answer: "\u2C97\u2C81",
    audioId: "la",
  },
  {
    id: "group-4-ni-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["li", "na", "ni", "te"],
    answer: "ni",
    audioId: "ni",
  },
  {
    id: "group-4-ne-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ne"',
    display: "ne",
    choices: ["\u2C9B\u2C89", "\u2C9B\u2C93", "\u2C97\u2C89", "\u2C99\u2C89"],
    answer: "\u2C9B\u2C89",
    audioId: "ne",
  },
  {
    id: "group-4-li-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["li", "le", "ni", "la"],
    answer: "li",
    audioId: "li",
  },
];

const SECTION_1_UNIT_1_GROUP_2_LESSON_5_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-5-ee-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "ee"',
    display: "ee",
    choices: ["\u2C89", "\u2C8F", "\u2C83\u2C8F", "\u2C95\u2C8F"],
    answer: "\u2C8F",
    audioId: "ee",
  },
  {
    id: "group-5-vi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["vi", "pi", "ti", "ni"],
    answer: "vi",
    audioId: "vi",
  },
  {
    id: "group-5-review-match-1",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C83\u2C89", right: "ve" },
      { left: "\u2C95\u2C8F", right: "kee" },
      { left: "\u2CA1\u2C81", right: "pa" },
      { left: "\u2CA7\u2C89", right: "te" },
      { left: "\u2C9B\u2C93", right: "ni" },
    ],
  },
  {
    id: "group-5-te-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "te"',
    display: "te",
    choices: ["\u2CA7\u2C89", "\u2C9B\u2C89", "\u2C97\u2C89", "\u2C83\u2C89"],
    answer: "\u2CA7\u2C89",
    audioId: "te",
  },
  {
    id: "group-5-ni-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ni", "li", "mi", "pi"],
    answer: "ni",
    audioId: "ni",
  },
  {
    id: "group-5-review-match-2",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2CA7\u2C93", right: "ti" },
      { left: "\u2C99\u2C8F", right: "mee" },
      { left: "\u2C9B\u2C81", right: "na" },
      { left: "\u2C97\u2C93", right: "li" },
      { left: "\u2CA1\u2C9F", right: "po" },
    ],
  },
  {
    id: "group-5-pod-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "pod"',
    display: "pod",
    choices: ["\u2CA1\u2C9F", "\u2CA1\u2C9F\u2C87", "\u2CA1\u2C81", "\u2CA1\u2C93"],
    answer: "\u2CA1\u2C9F\u2C87",
    audioId: "pod",
  },
  {
    id: "group-5-kee-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["kee", "mee", "tee", "vee"],
    answer: "kee",
    audioId: "kee",
  },
  {
    id: "group-5-ne-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ne"',
    display: "ne",
    choices: ["\u2C9B\u2C89", "\u2C97\u2C89", "\u2C99\u2C89", "\u2C9B\u2C93"],
    answer: "\u2C9B\u2C89",
    audioId: "ne",
  },
  {
    id: "group-5-la-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["la", "na", "le", "li"],
    answer: "la",
    audioId: "la",
  },
  {
    id: "group-5-review-match-3",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C89", right: "e" },
      { left: "\u2C8F", right: "ee" },
      { left: "\u2C83\u2C93", right: "vi" },
      { left: "\u2C99\u2C89", right: "me" },
      { left: "\u2C97\u2C81", right: "la" },
    ],
  },
];

const SECTION_1_UNIT_1_GROUP_2_REVIEW_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-2-review-vee-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "vee"',
    display: "vee",
    choices: ["\u2C83\u2C89", "\u2C83\u2C8F", "\u2C95\u2C8F", "\u2CA7\u2C8F"],
    answer: "\u2C83\u2C8F",
    audioId: "vee",
  },
  {
    id: "group-2-review-pi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["pi", "vi", "ti", "ni"],
    answer: "pi",
    audioId: "pi",
  },
  {
    id: "group-2-review-mee-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["mee", "vee", "tee", "kee"],
    answer: "mee",
    audioId: "mee",
  },
  {
    id: "group-2-review-te-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "te"',
    display: "te",
    choices: ["\u2CA7\u2C89", "\u2C99\u2C89", "\u2C97\u2C89", "\u2C9B\u2C89"],
    answer: "\u2CA7\u2C89",
    audioId: "te",
  },
  {
    id: "group-2-review-na-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9B\u2C81",
    choices: ["na", "la", "ne"],
    answer: "na",
    audioId: "na",
  },
  {
    id: "group-2-review-foundations-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C89", right: "e" },
      { left: "\u2C8F", right: "ee" },
      { left: "\u2C83\u2C89", right: "ve" },
      { left: "\u2CA1\u2C81", right: "pa" },
      { left: "\u2CA7\u2C93", right: "ti" },
    ],
  },
  {
    id: "group-2-review-extensions-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2CA1\u2C9F\u2C87", right: "pod" },
      { left: "\u2C95\u2C8F", right: "kee" },
      { left: "\u2C99\u2C8F", right: "mee" },
      { left: "\u2C9B\u2C93", right: "ni" },
      { left: "\u2C97\u2C81", right: "la" },
    ],
  },
  {
    id: "group-2-review-pod-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "pod"',
    display: "pod",
    choices: ["\u2CA1\u2C9F", "\u2CA1\u2C9F\u2C87", "\u2CA1\u2C81", "\u2C83\u2C93"],
    answer: "\u2CA1\u2C9F\u2C87",
    audioId: "pod",
  },
  {
    id: "group-2-review-li-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C97\u2C93",
    choices: ["li", "le", "ni"],
    answer: "li",
    audioId: "li",
  },
  {
    id: "group-2-review-tee-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA7\u2C8F",
    choices: ["te", "tee", "mee"],
    answer: "tee",
    audioId: "tee",
  },
];

const SECTION_1_UNIT_1_GROUP_3_LESSON_1_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-11-ga-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["gha", "sa", "ge", "ee"],
    answer: "gha",
    audioId: "gha",
  },
  {
    id: "group-11-sa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "sa"',
    display: "sa",
    choices: ["\u2CA5\u2C81", "\u2C85\u2C81", "\u2CA5\u2C89", "\u2C85\u2C89"],
    answer: "\u2CA5\u2C81",
    audioId: "sa",
  },
  {
    id: "group-11-ge-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ge"',
    display: "ge",
    choices: ["\u2C85\u2C89", "\u2CA5\u2C89", "\u2C85\u2C81", "\u2C85\u2C93"],
    answer: "\u2C85\u2C89",
    audioId: "ge",
  },
  {
    id: "group-11-se-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["sa", "se", "ge", "ee"],
    answer: "se",
    audioId: "se",
  },
  {
    id: "group-11-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C85\u2C81", right: "gha" },
      { left: "\u2CA5\u2C81", right: "sa" },
      { left: "\u2C85\u2C89", right: "ge" },
      { left: "\u2CA5\u2C89", right: "se" },
      { left: "\u2CA9", right: "ee" },
    ],
  },
  {
    id: "group-11-ee-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "ee"',
    display: "ee",
    choices: ["\u2CA9", "\u2C9F", "\u2CA9\u2C81", "\u2C89"],
    answer: "\u2CA9",
    audioId: "ee",
  },
  {
    id: "group-11-ee-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ee", "gha", "se", "ge"],
    answer: "ee",
    audioId: "ee",
  },
  {
    id: "group-11-ga-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "gha"',
    display: "gha",
    choices: ["\u2C85\u2C81", "\u2C85\u2C89", "\u2CA5\u2C81", "\u2CA5\u2C89"],
    answer: "\u2C85\u2C81",
    audioId: "gha",
  },
  {
    id: "group-11-ge-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ge", "gha", "se", "sa"],
    answer: "ge",
    audioId: "ge",
  },
  {
    id: "group-11-se-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA5\u2C89",
    choices: ["se", "sa", "ge"],
    answer: "se",
    audioId: "se",
  },
];

const SECTION_1_UNIT_1_GROUP_3_LESSON_2_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-12-gi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["gi", "si", "ge", "gha"],
    answer: "gi",
    audioId: "gi",
  },
  {
    id: "group-12-si-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "si"',
    display: "si",
    choices: ["\u2CA5\u2C93", "\u2C85\u2C93", "\u2CA5\u2C89", "\u2CA5\u2C81"],
    answer: "\u2CA5\u2C93",
    audioId: "si",
  },
  {
    id: "group-12-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C85\u2C93", right: "gi" },
      { left: "\u2CA5\u2C93", right: "si" },
      { left: "\u2C85\u2C81", right: "gha" },
      { left: "\u2CA5\u2C89", right: "se" },
      { left: "\u2CA9", right: "ee" },
    ],
  },
  {
    id: "group-12-gi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C85\u2C93",
    choices: ["gi", "ge", "si"],
    answer: "gi",
    audioId: "gi",
  },
  {
    id: "group-12-gee-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["gee", "see", "ge", "se"],
    answer: "gee",
    audioId: "gee",
  },
  {
    id: "group-12-ge-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ge"',
    display: "ge",
    choices: ["\u2C85\u2C89", "\u2CA5\u2C89", "\u2C85\u2C93", "\u2CA5\u2C93"],
    answer: "\u2C85\u2C89",
    audioId: "ge",
  },
  {
    id: "group-12-sa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["sa", "se", "si", "gha"],
    answer: "sa",
    audioId: "sa",
  },
  {
    id: "group-12-bridge-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C85\u2C81", right: "gha" },
      { left: "\u2CA5\u2CA9", right: "see" },
      { left: "\u2C85\u2C89", right: "ge" },
      { left: "\u2CA5\u2C81", right: "sa" },
      { left: "\u2C85\u2C93", right: "gi" },
    ],
  },
  {
    id: "group-12-see-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["see", "gee", "se", "sa"],
    answer: "see",
    audioId: "see",
  },
  {
    id: "group-12-si-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA5\u2C93",
    choices: ["si", "se", "sa"],
    answer: "si",
    audioId: "si",
  },
];

const SECTION_1_UNIT_1_GROUP_3_LESSON_3_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-13-tha-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["tha", "fa", "the", "oh"],
    answer: "tha",
    audioId: "tha",
  },
  {
    id: "group-13-fa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "fa"',
    display: "fa",
    choices: ["\u2CAB\u2C81", "\u2C91\u2C81", "\u2CAB\u2C89", "\u2C91\u2C89"],
    answer: "\u2CAB\u2C81",
    audioId: "fa",
  },
  {
    id: "group-13-the-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "the"',
    display: "the",
    choices: ["\u2C91\u2C89", "\u2CAB\u2C89", "\u2C91\u2C81", "\u2C91\u2C93"],
    answer: "\u2C91\u2C89",
    audioId: "the",
  },
  {
    id: "group-13-fe-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["fa", "fe", "the", "oh"],
    answer: "fe",
    audioId: "fe",
  },
  {
    id: "group-13-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C91\u2C81", right: "tha" },
      { left: "\u2CAB\u2C81", right: "fa" },
      { left: "\u2C91\u2C89", right: "the" },
      { left: "\u2CAB\u2C89", right: "fe" },
      { left: "\u2CB1", right: "oh" },
    ],
  },
  {
    id: "group-13-oh-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "oh"',
    display: "oh",
    choices: ["\u2CB1", "\u2C9F", "\u2CA9", "\u2CB1\u2C81"],
    answer: "\u2CB1",
    audioId: "oh",
  },
  {
    id: "group-13-oh-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["oh", "tha", "fe", "the"],
    answer: "oh",
    audioId: "oh",
  },
  {
    id: "group-13-tha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "tha"',
    display: "tha",
    choices: ["\u2C91\u2C81", "\u2C91\u2C89", "\u2CAB\u2C81", "\u2CAB\u2C89"],
    answer: "\u2C91\u2C81",
    audioId: "tha",
  },
  {
    id: "group-13-the-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["the", "tha", "fe", "fa"],
    answer: "the",
    audioId: "the",
  },
  {
    id: "group-13-fe-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CAB\u2C89",
    choices: ["fe", "fa", "the"],
    answer: "fe",
    audioId: "fe",
  },
];

const SECTION_1_UNIT_1_GROUP_3_LESSON_4_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-14-thi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["thi", "fi", "the", "fa"],
    answer: "thi",
    audioId: "thi",
  },
  {
    id: "group-14-fi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "fi"',
    display: "fi",
    choices: ["\u2CAB\u2C93", "\u2C91\u2C93", "\u2CAB\u2C89", "\u2CAB\u2C81"],
    answer: "\u2CAB\u2C93",
    audioId: "fi",
  },
  {
    id: "group-14-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C91\u2C93", right: "thi" },
      { left: "\u2CAB\u2C93", right: "fi" },
      { left: "\u2C91\u2C81", right: "tha" },
      { left: "\u2CAB\u2C81", right: "fa" },
      { left: "\u2CB1", right: "oh" },
    ],
  },
  {
    id: "group-14-thi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C91\u2C93",
    choices: ["thi", "the", "fi"],
    answer: "thi",
    audioId: "thi",
  },
  {
    id: "group-14-thoh-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["thoh", "foh", "thi", "fe"],
    answer: "thoh",
    audioId: "thoh",
  },
  {
    id: "group-14-fe-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "fe"',
    display: "fe",
    choices: ["\u2CAB\u2C89", "\u2CAB\u2C93", "\u2C91\u2C89", "\u2CAB\u2C81"],
    answer: "\u2CAB\u2C89",
    audioId: "fe",
  },
  {
    id: "group-14-fa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["fa", "fe", "fi", "tha"],
    answer: "fa",
    audioId: "fa",
  },
  {
    id: "group-14-bridge-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C91\u2CB1", right: "thoh" },
      { left: "\u2CAB\u2CB1", right: "foh" },
      { left: "\u2C91\u2C89", right: "the" },
      { left: "\u2CAB\u2C81", right: "fa" },
      { left: "\u2CAB\u2C93", right: "fi" },
    ],
  },
  {
    id: "group-14-foh-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["foh", "thoh", "fi", "fa"],
    answer: "foh",
    audioId: "foh",
  },
  {
    id: "group-14-fi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CAB\u2C93",
    choices: ["fi", "fe", "fa"],
    answer: "fi",
    audioId: "fi",
  },
];

const SECTION_1_UNIT_1_GROUP_3_LESSON_5_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-15-gha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "gha"',
    display: "gha",
    choices: ["\u2C85\u2C81", "\u2C85\u2C89", "\u2CA5\u2C81", "\u2CA5\u2C89"],
    answer: "\u2C85\u2C81",
    audioId: "gha",
  },
  {
    id: "group-15-se-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["se", "sa", "ge", "ee"],
    answer: "se",
    audioId: "se",
  },
  {
    id: "group-15-foundations-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C85\u2C81", right: "gha" },
      { left: "\u2CA5\u2C81", right: "sa" },
      { left: "\u2C85\u2C89", right: "ge" },
      { left: "\u2CA5\u2C89", right: "se" },
      { left: "\u2CA9", right: "ee" },
    ],
  },
  {
    id: "group-15-gee-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["gee", "ge", "gha", "sa"],
    answer: "gee",
    audioId: "gee",
  },
  {
    id: "group-15-si-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "si"',
    display: "si",
    choices: ["\u2CA5\u2C93", "\u2CA5\u2C89", "\u2CA5\u2C81", "\u2C85\u2C93"],
    answer: "\u2CA5\u2C93",
    audioId: "si",
  },
  {
    id: "group-15-gi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C85\u2C93",
    choices: ["gi", "ge", "gha"],
    answer: "gi",
    audioId: "gi",
  },
  {
    id: "group-15-see-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA5\u2CA9",
    choices: ["see", "se", "sa"],
    answer: "see",
    audioId: "see",
  },
  {
    id: "group-15-tha-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["tha", "fa", "the", "oh"],
    answer: "tha",
    audioId: "tha",
  },
  {
    id: "group-15-the-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "the"',
    display: "the",
    choices: ["\u2C91\u2C89", "\u2CAB\u2C89", "\u2C91\u2C81", "\u2C91\u2C93"],
    answer: "\u2C91\u2C89",
    audioId: "the",
  },
  {
    id: "group-15-th-f-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C91\u2C81", right: "tha" },
      { left: "\u2CAB\u2C81", right: "fa" },
      { left: "\u2C91\u2C89", right: "the" },
      { left: "\u2CAB\u2C89", right: "fe" },
      { left: "\u2CB1", right: "oh" },
    ],
  },
  {
    id: "group-15-thi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["thi", "fi", "the", "fa"],
    answer: "thi",
    audioId: "thi",
  },
  {
    id: "group-15-fi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "fi"',
    display: "fi",
    choices: ["\u2CAB\u2C93", "\u2C91\u2C93", "\u2CAB\u2C89", "\u2CAB\u2C81"],
    answer: "\u2CAB\u2C93",
    audioId: "fi",
  },
  {
    id: "group-15-oh-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CB1",
    choices: ["oh", "ee", "fa"],
    answer: "oh",
    audioId: "oh",
  },
  {
    id: "group-15-foh-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["foh", "thoh", "fi", "fa"],
    answer: "foh",
    audioId: "foh",
  },
  {
    id: "group-15-final-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C91\u2C93", right: "thi" },
      { left: "\u2CAB\u2C93", right: "fi" },
      { left: "\u2C91\u2CB1", right: "thoh" },
      { left: "\u2CAB\u2CB1", right: "foh" },
      { left: "\u2CAB\u2C81", right: "fa" },
    ],
  },
];

const SECTION_1_UNIT_1_GROUP_4_LESSON_1_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-16-sha-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["sha", "fa", "she", "ksa"],
    answer: "sha",
    audioId: "sha",
  },
  {
    id: "group-16-fa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "fa"',
    display: "fa",
    choices: ["\u03E5\u2C81", "\u03E3\u2C81", "\u03E5\u2C89", "\u03E3\u2C89"],
    answer: "\u03E5\u2C81",
    audioId: "fa",
  },
  {
    id: "group-16-she-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "she"',
    display: "she",
    choices: ["\u03E3\u2C89", "\u03E5\u2C89", "\u03E3\u2C81", "\u03E3\u2C93"],
    answer: "\u03E3\u2C89",
    audioId: "she",
  },
  {
    id: "group-16-fe-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["fa", "fe", "she", "ksa"],
    answer: "fe",
    audioId: "fe",
  },
  {
    id: "group-16-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E3\u2C81", right: "sha" },
      { left: "\u03E5\u2C81", right: "fa" },
      { left: "\u03E3\u2C89", right: "she" },
      { left: "\u03E5\u2C89", right: "fe" },
      { left: "\u2C9D\u2C81", right: "ksa" },
    ],
  },
  {
    id: "group-16-ksa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ksa"',
    display: "ksa",
    choices: ["\u2C9D\u2C81", "\u03E3\u2C81", "\u03E5\u2C81", "\u2C9D\u2C93"],
    answer: "\u2C9D\u2C81",
    audioId: "ksa",
  },
  {
    id: "group-16-ksa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ksa", "sha", "fe", "she"],
    answer: "ksa",
    audioId: "ksa",
  },
  {
    id: "group-16-sha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "sha"',
    display: "sha",
    choices: ["\u03E3\u2C81", "\u03E3\u2C89", "\u03E5\u2C81", "\u2C9D\u2C81"],
    answer: "\u03E3\u2C81",
    audioId: "sha",
  },
  {
    id: "group-16-she-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["she", "sha", "fe", "fa"],
    answer: "she",
    audioId: "she",
  },
  {
    id: "group-16-fe-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03E5\u2C89",
    choices: ["fe", "fa", "she"],
    answer: "fe",
    audioId: "fe",
  },
];

const SECTION_1_UNIT_1_GROUP_4_LESSON_2_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-17-shi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["shi", "fi", "she", "fa"],
    answer: "shi",
    audioId: "shi",
  },
  {
    id: "group-17-fi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "fi"',
    display: "fi",
    choices: ["\u03E5\u2C93", "\u03E3\u2C93", "\u03E5\u2C89", "\u03E5\u2C81"],
    answer: "\u03E5\u2C93",
    audioId: "fi",
  },
  {
    id: "group-17-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E3\u2C93", right: "shi" },
      { left: "\u03E5\u2C93", right: "fi" },
      { left: "\u03E3\u2C81", right: "sha" },
      { left: "\u03E5\u2C81", right: "fa" },
      { left: "\u2C9D\u2C81", right: "ksa" },
    ],
  },
  {
    id: "group-17-shi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03E3\u2C93",
    choices: ["shi", "she", "fi"],
    answer: "shi",
    audioId: "shi",
  },
  {
    id: "group-17-ksi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ksi", "ksa", "shi", "fi"],
    answer: "ksi",
    audioId: "ksi",
  },
  {
    id: "group-17-sha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "sha"',
    display: "sha",
    choices: ["\u03E3\u2C81", "\u03E3\u2C93", "\u03E5\u2C81", "\u2C9D\u2C81"],
    answer: "\u03E3\u2C81",
    audioId: "sha",
  },
  {
    id: "group-17-fa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["fa", "fe", "fi", "sha"],
    answer: "fa",
    audioId: "fa",
  },
  {
    id: "group-17-bridge-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E3\u2C89", right: "she" },
      { left: "\u03E5\u2C93", right: "fi" },
      { left: "\u2C9D\u2C93", right: "ksi" },
      { left: "\u03E5\u2C81", right: "fa" },
      { left: "\u03E3\u2C93", right: "shi" },
    ],
  },
  {
    id: "group-17-fi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["fi", "shi", "fe", "ksa"],
    answer: "fi",
    audioId: "fi",
  },
  {
    id: "group-17-ksi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9D\u2C93",
    choices: ["ksi", "ksa", "shi"],
    answer: "ksi",
    audioId: "ksi",
  },
];

const SECTION_1_UNIT_1_GROUP_4_LESSON_3_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-18-ha-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ha", "kha", "he", "ksa"],
    answer: "ha",
    audioId: "ha",
  },
  {
    id: "group-18-kha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "kha"',
    display: "kha",
    choices: ["\u03E7\u2C81", "\u03E9\u2C81", "\u03E7\u2C89", "\u03E9\u2C89"],
    answer: "\u03E7\u2C81",
    audioId: "kha",
  },
  {
    id: "group-18-he-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "he"',
    display: "he",
    choices: ["\u03E9\u2C89", "\u03E7\u2C89", "\u03E9\u2C81", "\u03E9\u2C93"],
    answer: "\u03E9\u2C89",
    audioId: "he",
  },
  {
    id: "group-18-khe-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["kha", "khe", "he", "ksa"],
    answer: "khe",
    audioId: "khe",
  },
  {
    id: "group-18-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E9\u2C81", right: "ha" },
      { left: "\u03E7\u2C81", right: "kha" },
      { left: "\u03E9\u2C89", right: "he" },
      { left: "\u03E7\u2C89", right: "khe" },
      { left: "\u2C9D\u2C81", right: "ksa" },
    ],
  },
  {
    id: "group-18-ksa-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9D\u2C81",
    choices: ["ksa", "ha", "kha"],
    answer: "ksa",
    audioId: "ksa",
  },
  {
    id: "group-18-ksa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ksa", "ha", "khe", "he"],
    answer: "ksa",
    audioId: "ksa",
  },
  {
    id: "group-18-ha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ha"',
    display: "ha",
    choices: ["\u03E9\u2C81", "\u03E9\u2C89", "\u03E7\u2C81", "\u2C9D\u2C81"],
    answer: "\u03E9\u2C81",
    audioId: "ha",
  },
  {
    id: "group-18-he-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["he", "ha", "khe", "kha"],
    answer: "he",
    audioId: "he",
  },
  {
    id: "group-18-khe-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03E7\u2C89",
    choices: ["khe", "kha", "he"],
    answer: "khe",
    audioId: "khe",
  },
];

const SECTION_1_UNIT_1_GROUP_4_LESSON_4_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-19-hi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["hi", "khi", "he", "kha"],
    answer: "hi",
    audioId: "hi",
  },
  {
    id: "group-19-khi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "khi"',
    display: "khi",
    choices: ["\u03E7\u2C93", "\u03E9\u2C93", "\u03E7\u2C89", "\u03E7\u2C81"],
    answer: "\u03E7\u2C93",
    audioId: "khi",
  },
  {
    id: "group-19-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E9\u2C93", right: "hi" },
      { left: "\u03E7\u2C93", right: "khi" },
      { left: "\u03E9\u2C81", right: "ha" },
      { left: "\u03E7\u2C81", right: "kha" },
      { left: "\u2C9D\u2C81", right: "ksa" },
    ],
  },
  {
    id: "group-19-hi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03E9\u2C93",
    choices: ["hi", "he", "khi"],
    answer: "hi",
    audioId: "hi",
  },
  {
    id: "group-19-ksi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ksi", "ksa", "hi", "khi"],
    answer: "ksi",
    audioId: "ksi",
  },
  {
    id: "group-19-ha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ha"',
    display: "ha",
    choices: ["\u03E9\u2C81", "\u03E9\u2C93", "\u03E7\u2C81", "\u2C9D\u2C81"],
    answer: "\u03E9\u2C81",
    audioId: "ha",
  },
  {
    id: "group-19-kha-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["kha", "khe", "khi", "ha"],
    answer: "kha",
    audioId: "kha",
  },
  {
    id: "group-19-bridge-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E9\u2C89", right: "he" },
      { left: "\u03E7\u2C93", right: "khi" },
      { left: "\u2C9D\u2C93", right: "ksi" },
      { left: "\u03E7\u2C81", right: "kha" },
      { left: "\u03E9\u2C93", right: "hi" },
    ],
  },
  {
    id: "group-19-khi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["khi", "hi", "khe", "ksa"],
    answer: "khi",
    audioId: "khi",
  },
  {
    id: "group-19-ksi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9D\u2C93",
    choices: ["ksi", "ksa", "hi"],
    answer: "ksi",
    audioId: "ksi",
  },
];

const SECTION_1_UNIT_1_GROUP_4_LESSON_5_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-20-sha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "sha"',
    display: "sha",
    choices: ["\u03E3\u2C81", "\u03E3\u2C89", "\u03E5\u2C81", "\u2C9D\u2C81"],
    answer: "\u03E3\u2C81",
    audioId: "sha",
  },
  {
    id: "group-20-fe-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["fe", "fa", "she", "khe"],
    answer: "fe",
    audioId: "fe",
  },
  {
    id: "group-20-sh-f-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E3\u2C81", right: "sha" },
      { left: "\u03E5\u2C81", right: "fa" },
      { left: "\u03E3\u2C89", right: "she" },
      { left: "\u03E5\u2C89", right: "fe" },
      { left: "\u2C9D\u2C81", right: "ksa" },
    ],
  },
  {
    id: "group-20-shi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03E3\u2C93",
    choices: ["shi", "she", "fi"],
    answer: "shi",
    audioId: "shi",
  },
  {
    id: "group-20-fi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["fi", "shi", "fe", "ksa"],
    answer: "fi",
    audioId: "fi",
  },
  {
    id: "group-20-bridge-match-1",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E3\u2C89", right: "she" },
      { left: "\u03E5\u2C93", right: "fi" },
      { left: "\u2C9D\u2C93", right: "ksi" },
      { left: "\u03E5\u2C81", right: "fa" },
      { left: "\u03E3\u2C93", right: "shi" },
    ],
  },
  {
    id: "group-20-ha-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ha", "kha", "he", "ksa"],
    answer: "ha",
    audioId: "ha",
  },
  {
    id: "group-20-khe-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "khe"',
    display: "khe",
    choices: ["\u03E7\u2C89", "\u03E7\u2C81", "\u03E9\u2C89", "\u03E7\u2C93"],
    answer: "\u03E7\u2C89",
    audioId: "khe",
  },
  {
    id: "group-20-h-kh-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E9\u2C81", right: "ha" },
      { left: "\u03E7\u2C81", right: "kha" },
      { left: "\u03E9\u2C89", right: "he" },
      { left: "\u03E7\u2C89", right: "khe" },
      { left: "\u2C9D\u2C81", right: "ksa" },
    ],
  },
  {
    id: "group-20-he-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03E9\u2C89",
    choices: ["he", "ha", "khe"],
    answer: "he",
    audioId: "he",
  },
  {
    id: "group-20-khi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["khi", "hi", "khe", "ksa"],
    answer: "khi",
    audioId: "khi",
  },
  {
    id: "group-20-hi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "hi"',
    display: "hi",
    choices: ["\u03E9\u2C93", "\u03E9\u2C89", "\u03E7\u2C93", "\u03E9\u2C81"],
    answer: "\u03E9\u2C93",
    audioId: "hi",
  },
  {
    id: "group-20-bridge-match-2",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E9\u2C89", right: "he" },
      { left: "\u03E7\u2C93", right: "khi" },
      { left: "\u2C9D\u2C93", right: "ksi" },
      { left: "\u03E7\u2C81", right: "kha" },
      { left: "\u03E9\u2C93", right: "hi" },
    ],
  },
  {
    id: "group-20-ksi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9D\u2C93",
    choices: ["ksi", "ksa", "khi"],
    answer: "ksi",
    audioId: "ksi",
  },
  {
    id: "group-20-kha-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["kha", "ha", "sha", "ksa"],
    answer: "kha",
    audioId: "kha",
  },
];

const SECTION_1_UNIT_1_GROUP_5_LESSON_1_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-21-ja-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ga", "cha", "je", "kha"],
    answer: "ga",
    audioId: "ga",
  },
  {
    id: "group-21-cha-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "cha"',
    display: "cha",
    choices: ["\u03ED\u2C81", "\u03EB\u2C81", "\u03ED\u2C89", "\u03EB\u2C89"],
    answer: "\u03ED\u2C81",
    audioId: "cha",
  },
  {
    id: "group-21-je-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "je"',
    display: "je",
    choices: ["\u03EB\u2C89", "\u03ED\u2C89", "\u03EB\u2C81", "\u03EB\u2C93"],
    answer: "\u03EB\u2C89",
    audioId: "je",
  },
  {
    id: "group-21-che-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["cha", "che", "je", "kha"],
    answer: "che",
    audioId: "che",
  },
  {
    id: "group-21-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03EB\u2C81", right: "ga" },
      { left: "\u03ED\u2C81", right: "cha" },
      { left: "\u03EB\u2C89", right: "je" },
      { left: "\u03ED\u2C89", right: "che" },
      { left: "\u2CAD\u2C81", right: "kha" },
    ],
  },
  {
    id: "group-21-xa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "kha"',
    display: "kha",
    choices: ["\u2CAD\u2C81", "\u03EB\u2C81", "\u03ED\u2C81", "\u2CAD\u2C93"],
    answer: "\u2CAD\u2C81",
    audioId: "kha",
  },
  {
    id: "group-21-xa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["kha", "ga", "che", "je"],
    answer: "kha",
    audioId: "kha",
  },
  {
    id: "group-21-ja-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ga"',
    display: "ga",
    choices: ["\u03EB\u2C81", "\u03EB\u2C89", "\u03ED\u2C81", "\u2CAD\u2C81"],
    answer: "\u03EB\u2C81",
    audioId: "ga",
  },
  {
    id: "group-21-je-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["je", "ga", "che", "cha"],
    answer: "je",
    audioId: "je",
  },
  {
    id: "group-21-che-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03ED\u2C89",
    choices: ["che", "cha", "je"],
    answer: "che",
    audioId: "che",
  },
];

const SECTION_1_UNIT_1_GROUP_5_LESSON_2_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-22-ji-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ji", "chi", "je", "cha"],
    answer: "ji",
    audioId: "ji",
  },
  {
    id: "group-22-chi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "chi"',
    display: "chi",
    choices: ["\u03ED\u2C93", "\u03EB\u2C93", "\u03ED\u2C89", "\u03ED\u2C81"],
    answer: "\u03ED\u2C93",
    audioId: "chi",
  },
  {
    id: "group-22-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03EB\u2C93", right: "ji" },
      { left: "\u03ED\u2C93", right: "chi" },
      { left: "\u03EB\u2C81", right: "ga" },
      { left: "\u03ED\u2C81", right: "cha" },
      { left: "\u2CAD\u2C81", right: "kha" },
    ],
  },
  {
    id: "group-22-ji-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03EB\u2C93",
    choices: ["ji", "je", "chi"],
    answer: "ji",
    audioId: "ji",
  },
  {
    id: "group-22-xi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["khi", "kha", "ji", "chi"],
    answer: "khi",
    audioId: "khi",
  },
  {
    id: "group-22-ja-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ga"',
    display: "ga",
    choices: ["\u03EB\u2C81", "\u03EB\u2C93", "\u03ED\u2C81", "\u2CAD\u2C81"],
    answer: "\u03EB\u2C81",
    audioId: "ga",
  },
  {
    id: "group-22-cha-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["cha", "che", "chi", "ga"],
    answer: "cha",
    audioId: "cha",
  },
  {
    id: "group-22-bridge-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03EB\u2C89", right: "je" },
      { left: "\u03ED\u2C93", right: "chi" },
      { left: "\u2CAD\u2C93", right: "khi" },
      { left: "\u03ED\u2C81", right: "cha" },
      { left: "\u03EB\u2C93", right: "ji" },
    ],
  },
  {
    id: "group-22-chi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["chi", "ji", "che", "kha"],
    answer: "chi",
    audioId: "chi",
  },
  {
    id: "group-22-xi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CAD\u2C93",
    choices: ["khi", "kha", "ji"],
    answer: "khi",
    audioId: "khi",
  },
];

const SECTION_1_UNIT_1_GROUP_5_LESSON_3_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-23-psa-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["psa", "ga", "cha", "kha"],
    answer: "psa",
    audioId: "psa",
  },
  {
    id: "group-23-ti-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "ti"',
    display: "ti",
    choices: ["ϯ", "\u03EB\u2C93", "\u03ED\u2C93", "\u2CAF\u2C93"],
    answer: "ϯ",
    audioId: "ti",
  },
  {
    id: "group-23-pse-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "pse"',
    display: "pse",
    choices: ["\u2CAF\u2C89", "\u2CAF\u2C81", "\u03ED\u2C89", "\u03EB\u2C89"],
    answer: "\u2CAF\u2C89",
    audioId: "pse",
  },
  {
    id: "group-23-kha-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["kha", "psa", "je", "cha"],
    answer: "kha",
    audioId: "kha",
  },
  {
    id: "group-23-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2CAF\u2C81", right: "psa" },
      { left: "\u2CAF\u2C89", right: "pse" },
      { left: "ϯ", right: "ti" },
      { left: "\u2CAD\u2C81", right: "kha" },
      { left: "\u03EB\u2C89", right: "je" },
    ],
  },
  {
    id: "group-23-kha-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CAD\u2C81",
    choices: ["kha", "psa", "pse"],
    answer: "kha",
    audioId: "kha",
  },
  {
    id: "group-23-ti-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ti", "ji", "chi", "psa"],
    answer: "ti",
    audioId: "ti",
  },
  {
    id: "group-23-psa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "psa"',
    display: "psa",
    choices: ["\u2CAF\u2C81", "\u2CAF\u2C89", "\u03ED\u2C81", "\u03EB\u2C81"],
    answer: "\u2CAF\u2C81",
    audioId: "psa",
  },
  {
    id: "group-23-pse-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["pse", "psa", "je", "che"],
    answer: "pse",
    audioId: "pse",
  },
  {
    id: "group-23-ti-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ϯ",
    choices: ["ti", "psa", "pse"],
    answer: "ti",
    audioId: "ti",
  },
];

const SECTION_1_UNIT_1_GROUP_5_LESSON_4_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-24-psi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["psi", "ji", "chi", "khi"],
    answer: "psi",
    audioId: "psi",
  },
  {
    id: "group-24-ti-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ϯ",
    choices: ["ti", "psi", "khi"],
    answer: "ti",
    audioId: "ti",
  },
  {
    id: "group-24-core-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2CAF\u2C93", right: "psi" },
      { left: "ϯ", right: "ti" },
      { left: "\u2CAD\u2C93", right: "khi" },
      { left: "\u03ED\u2C93", right: "chi" },
      { left: "\u03EB\u2C93", right: "ji" },
    ],
  },
  {
    id: "group-24-khi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["khi", "psi", "ji", "chi"],
    answer: "khi",
    audioId: "khi",
  },
  {
    id: "group-24-psi-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "psi"',
    display: "psi",
    choices: ["\u2CAF\u2C93", "\u03ED\u2C93", "\u03EB\u2C93", "\u2CAD\u2C93"],
    answer: "\u2CAF\u2C93",
    audioId: "psi",
  },
  {
    id: "group-24-ti-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ti", "psi", "khi", "ji"],
    answer: "ti",
    audioId: "ti",
  },
  {
    id: "group-24-khi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CAD\u2C93",
    choices: ["khi", "psi", "ji"],
    answer: "khi",
    audioId: "khi",
  },
  {
    id: "group-24-pse-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["pse", "psi", "je", "chi"],
    answer: "pse",
    audioId: "pse",
  },
  {
    id: "group-24-ti-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "ti"',
    display: "ti",
    choices: ["ϯ", "\u2CAF\u2C93", "\u03EB\u2C93", "\u03ED\u2C93"],
    answer: "ϯ",
    audioId: "ti",
  },
  {
    id: "group-24-psi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CAF\u2C93",
    choices: ["psi", "pse", "psa"],
    answer: "psi",
    audioId: "psi",
  },
];

const SECTION_1_UNIT_1_GROUP_5_LESSON_5_EXERCISES: PairLettersExercise[] = [
  {
    id: "group-25-ga-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ga"',
    display: "ga",
    choices: ["\u03EB\u2C81", "\u03EB\u2C89", "\u03ED\u2C81", "\u2CAF\u2C81"],
    answer: "\u03EB\u2C81",
    audioId: "ga",
  },
  {
    id: "group-25-che-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["che", "cha", "je", "kha"],
    answer: "che",
    audioId: "che",
  },
  {
    id: "group-25-j-cha-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03EB\u2C81", right: "ga" },
      { left: "\u03ED\u2C81", right: "cha" },
      { left: "\u03EB\u2C89", right: "je" },
      { left: "\u03ED\u2C89", right: "che" },
      { left: "\u2CAD\u2C81", right: "kha" },
    ],
  },
  {
    id: "group-25-ji-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03EB\u2C93",
    choices: ["ji", "je", "chi"],
    answer: "ji",
    audioId: "ji",
  },
  {
    id: "group-25-chi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["chi", "ji", "che", "khi"],
    answer: "chi",
    audioId: "chi",
  },
  {
    id: "group-25-j-bridge-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03EB\u2C93", right: "ji" },
      { left: "\u03ED\u2C93", right: "chi" },
      { left: "\u2CAD\u2C93", right: "khi" },
      { left: "\u03ED\u2C81", right: "cha" },
      { left: "\u03EB\u2C89", right: "je" },
    ],
  },
  {
    id: "group-25-psa-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "psa"',
    display: "psa",
    choices: ["\u2CAF\u2C81", "\u2CAF\u2C89", "\u2CAF\u2C93", "\u03EF"],
    answer: "\u2CAF\u2C81",
    audioId: "psa",
  },
  {
    id: "group-25-pse-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["pse", "psa", "psi", "ti"],
    answer: "pse",
    audioId: "pse",
  },
  {
    id: "group-25-psi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CAF\u2C93",
    choices: ["psi", "pse", "psa"],
    answer: "psi",
    audioId: "psi",
  },
  {
    id: "group-25-ps-ti-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2CAF\u2C81", right: "psa" },
      { left: "\u2CAF\u2C89", right: "pse" },
      { left: "\u2CAF\u2C93", right: "psi" },
      { left: "\u03EF", right: "ti" },
      { left: "\u2CAD\u2C93", right: "khi" },
    ],
  },
  {
    id: "group-25-ti-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letter for "ti"',
    display: "ti",
    choices: ["\u03EF", "\u2CAF\u2C93", "\u03EB\u2C93", "\u03ED\u2C93"],
    answer: "\u03EF",
    audioId: "ti",
  },
  {
    id: "group-25-ga-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ga", "cha", "psa", "je"],
    answer: "ga",
    audioId: "ga",
  },
  {
    id: "group-25-khi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CAD\u2C93",
    choices: ["khi", "kha", "psi"],
    answer: "khi",
    audioId: "khi",
  },
  {
    id: "group-25-psi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["psi", "ji", "chi", "pse"],
    answer: "psi",
    audioId: "psi",
  },
  {
    id: "group-25-final-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03EB\u2C81", right: "ga" },
      { left: "\u03ED\u2C93", right: "chi" },
      { left: "\u2CAF\u2C89", right: "pse" },
      { left: "\u03EF", right: "ti" },
      { left: "\u2CAD\u2C81", right: "kha" },
    ],
  },
];

const SECTION_1_UNIT_1_REVIEW_EXERCISES: PairLettersExercise[] = [
  {
    id: "unit-review-basics-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C81", right: "a" },
      { left: "\u2C9F", right: "o" },
      { left: "\u2C87\u2C81", right: "dha" },
      { left: "\u2C8D\u2C81", right: "za" },
      { left: "\u2CA3\u2C81\u2CA9", right: "rav" },
    ],
  },
  {
    id: "unit-review-lone-u-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA9",
    choices: ["ee", "i", "oh"],
    answer: "ee",
    audioId: "ee",
  },
  {
    id: "unit-review-vee-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["vee", "kee", "tee", "ee"],
    answer: "vee",
    audioId: "vee",
  },
  {
    id: "unit-review-group-2-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C89", right: "e" },
      { left: "\u2C83\u2C89", right: "ve" },
      { left: "\u2C95\u2C89", right: "ke" },
      { left: "\u2CA1\u2C81", right: "pa" },
      { left: "\u2C99\u2C89", right: "me" },
    ],
  },
  {
    id: "unit-review-eta-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C8F",
    choices: ["ee", "e", "i"],
    answer: "ee",
    audioId: "ee",
  },
  {
    id: "unit-review-ni-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ni", "li", "mi", "ti"],
    answer: "ni",
    audioId: "ni",
  },
  {
    id: "unit-review-group-2b-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2CA7\u2C89", right: "te" },
      { left: "\u2C9B\u2C81", right: "na" },
      { left: "\u2C97\u2C89", right: "le" },
      { left: "\u2C93", right: "i" },
      { left: "\u2C95\u2C8F", right: "kee" },
    ],
  },
  {
    id: "unit-review-group-3-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C85\u2C81", right: "gha" },
      { left: "\u2CA5\u2C81", right: "sa" },
      { left: "\u2C91\u2C81", right: "tha" },
      { left: "\u2CAB\u2C89", right: "fe" },
      { left: "\u2CB1", right: "oh" },
    ],
  },
  {
    id: "unit-review-see-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA5\u2CA9",
    choices: ["see", "si", "se"],
    answer: "see",
    audioId: "see",
  },
  {
    id: "unit-review-group-4-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "ϣⲁ", right: "sha" },
      { left: "ϥⲓ", right: "fi" },
      { left: "\u2C9D\u2C81", right: "ksa" },
      { left: "ϩⲁ", right: "ha" },
      { left: "ϧⲉ", right: "khe" },
    ],
  },
  {
    id: "unit-review-shi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["shi", "she", "sha", "fi"],
    answer: "shi",
    audioId: "shi",
  },
  {
    id: "unit-review-fe-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "ϥⲉ",
    choices: ["fe", "fa", "fi"],
    answer: "fe",
    audioId: "fe",
  },
  {
    id: "unit-review-group-5a-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03EB\u2C89", right: "je" },
      { left: "\u03ED\u2C81", right: "cha" },
      { left: "\u2CAD\u2C81", right: "kha" },
      { left: "\u2CAF\u2C81", right: "psa" },
      { left: "\u03EF", right: "ti" },
    ],
  },
  {
    id: "unit-review-ji-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["ji", "chi", "je", "ga"],
    answer: "ji",
    audioId: "ji",
  },
  {
    id: "unit-review-chi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03ED\u2C93",
    choices: ["chi", "che", "cha"],
    answer: "chi",
    audioId: "chi",
  },
  {
    id: "unit-review-group-5b-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03EB\u2C93", right: "ji" },
      { left: "\u03ED\u2C89", right: "che" },
      { left: "\u2CAD\u2C93", right: "khi" },
      { left: "\u2CAF\u2C93", right: "psi" },
      { left: "ϩⲓ", right: "hi" },
    ],
  },
  {
    id: "unit-review-li-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "li"',
    display: "li",
    choices: ["\u2C97\u2C93", "\u2C97\u2C89", "\u2C9B\u2C93", "\u2C99\u2C93"],
    answer: "\u2C97\u2C93",
    audioId: "li",
  },
  {
    id: "unit-review-psi-hear",
    kind: "hear-and-choose",
    prompt: "What do you hear?",
    choices: ["psi", "ji", "chi", "pse"],
    answer: "psi",
    audioId: "psi",
  },
  {
    id: "unit-review-ti-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CA7\u2C93",
    choices: ["ti", "te", "ni"],
    answer: "ti",
    audioId: "ti",
  },
  {
    id: "unit-review-khe-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "khe"',
    display: "khe",
    choices: ["ϧⲉ", "ϩⲉ", "\u2CAD\u2C81", "\u03ED\u2C89"],
    answer: "ϧⲉ",
    audioId: "khe",
  },
  {
    id: "unit-review-ksi-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2C9D\u2C93",
    choices: ["ksi", "ksa", "khi"],
    answer: "ksi",
    audioId: "ksi",
  },
  {
    id: "unit-review-ti-letter",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u03EF",
    choices: ["ti", "ji", "chi"],
    answer: "ti",
    audioId: "ti",
  },
  {
    id: "unit-review-early-letters-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u2C87\u2C93", right: "dhi" },
      { left: "\u2C8D\u2C93", right: "zi" },
      { left: "\u2CA3\u2C9F\u2C87", right: "rod" },
      { left: "\u2C83\u2C93", right: "vi" },
      { left: "\u2C85\u2C89", right: "ge" },
    ],
  },
  {
    id: "unit-review-bridge-letters-match",
    kind: "matching-pairs",
    prompt: "Tap the matching pairs",
    pairs: [
      { left: "\u03E3\u2C89", right: "she" },
      { left: "\u2C91\u2C89", right: "the" },
      { left: "\u2CAB\u2C81", right: "fa" },
      { left: "\u2C99\u2C93", right: "mi" },
      { left: "\u2CA1\u2C9F\u2C87", right: "pod" },
    ],
  },
  {
    id: "unit-review-oh-sound",
    kind: "sound-to-roman",
    prompt: "What sound does this make?",
    display: "\u2CB1",
    choices: ["oh", "o", "ee"],
    answer: "oh",
    audioId: "oh",
  },
  {
    id: "unit-review-ni-letter",
    kind: "roman-to-coptic",
    prompt: 'Select the correct letters for "ni"',
    display: "ni",
    choices: ["\u2C9B\u2C93", "\u2C97\u2C93", "\u2C99\u2C93", "\u2CA7\u2C93"],
    answer: "\u2C9B\u2C93",
    audioId: "ni",
  },
];

const LESSON_EXERCISE_SETS: Partial<Record<ExerciseSetId, PairLettersExercise[]>> = {
  "a-o-d-letters-and-sounds": A_O_D_LETTERS_EXERCISES,
  "pair-letters-and-sounds": PAIR_LETTERS_EXERCISES,
  "r-letters-and-sounds": R_LETTERS_EXERCISES,
  "w-y-semi-vowels": W_Y_SEMIVOWEL_EXERCISES,
  "arabic-coptic-bridge": ARABIC_COPTIC_BRIDGE_EXERCISES,
  "section-1-unit-1-group-2-lesson-1": SECTION_1_UNIT_1_GROUP_2_LESSON_1_EXERCISES,
  "section-1-unit-1-group-2-lesson-2": SECTION_1_UNIT_1_GROUP_2_LESSON_2_EXERCISES,
  "section-1-unit-1-group-2-lesson-3": SECTION_1_UNIT_1_GROUP_2_LESSON_3_EXERCISES,
  "section-1-unit-1-group-2-lesson-4": SECTION_1_UNIT_1_GROUP_2_LESSON_4_EXERCISES,
  "section-1-unit-1-group-2-lesson-5": SECTION_1_UNIT_1_GROUP_2_LESSON_5_EXERCISES,
  "section-1-unit-1-group-3-lesson-1": SECTION_1_UNIT_1_GROUP_3_LESSON_1_EXERCISES,
  "section-1-unit-1-group-3-lesson-2": SECTION_1_UNIT_1_GROUP_3_LESSON_2_EXERCISES,
  "section-1-unit-1-group-3-lesson-3": SECTION_1_UNIT_1_GROUP_3_LESSON_3_EXERCISES,
  "section-1-unit-1-group-3-lesson-4": SECTION_1_UNIT_1_GROUP_3_LESSON_4_EXERCISES,
  "section-1-unit-1-group-3-lesson-5": SECTION_1_UNIT_1_GROUP_3_LESSON_5_EXERCISES,
  "section-1-unit-1-group-4-lesson-1": SECTION_1_UNIT_1_GROUP_4_LESSON_1_EXERCISES,
  "section-1-unit-1-group-4-lesson-2": SECTION_1_UNIT_1_GROUP_4_LESSON_2_EXERCISES,
  "section-1-unit-1-group-4-lesson-3": SECTION_1_UNIT_1_GROUP_4_LESSON_3_EXERCISES,
  "section-1-unit-1-group-4-lesson-4": SECTION_1_UNIT_1_GROUP_4_LESSON_4_EXERCISES,
  "section-1-unit-1-group-4-lesson-5": SECTION_1_UNIT_1_GROUP_4_LESSON_5_EXERCISES,
  "section-1-unit-1-group-5-lesson-1": SECTION_1_UNIT_1_GROUP_5_LESSON_1_EXERCISES,
  "section-1-unit-1-group-5-lesson-2": SECTION_1_UNIT_1_GROUP_5_LESSON_2_EXERCISES,
  "section-1-unit-1-group-5-lesson-3": SECTION_1_UNIT_1_GROUP_5_LESSON_3_EXERCISES,
  "section-1-unit-1-group-5-lesson-4": SECTION_1_UNIT_1_GROUP_5_LESSON_4_EXERCISES,
  "section-1-unit-1-group-5-lesson-5": SECTION_1_UNIT_1_GROUP_5_LESSON_5_EXERCISES,
  "section-1-unit-1-review": SECTION_1_UNIT_1_REVIEW_EXERCISES,
  "section-1-unit-1-group-1-review": SECTION_1_UNIT_1_GROUP_1_REVIEW_EXERCISES,
  "section-1-unit-1-group-2-review": SECTION_1_UNIT_1_GROUP_2_REVIEW_EXERCISES,
};

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

const LESSON_THEME = {
  bgTop: "#ded9c9",
  bgBottom: "#d6d1c0",
  textPrimary: "#2b4160",
  textSecondary: "rgba(43, 65, 96, 0.76)",
  progressTrack: "rgba(43, 65, 96, 0.16)",
  progressStart: "#687e9d",
  progressEnd: "#2b4160",
  retryBg: "rgba(43, 65, 96, 0.08)",
  retryBorder: "rgba(43, 65, 96, 0.14)",
  retryText: "#4f6887",
  cardTop: "#cfd9e6",
  cardBottom: "#bbc9dc",
  cardInset: "rgba(94, 113, 136, 0.46)",
  cardText: "#2b4160",
  choiceBorder: "rgba(43, 65, 96, 0.16)",
  choiceBg: "rgba(255, 255, 255, 0.34)",
  choiceSelectedBorder: "#6d84a3",
  choiceSelectedBg: "rgba(92, 112, 139, 0.14)",
  choiceSelectedText: "#2b4160",
  choiceCorrectBorder: "#7d8f62",
  choiceCorrectBg: "rgba(125, 143, 98, 0.12)",
  choiceCorrectText: "#3f5632",
  choiceWrongBorder: "#b57b74",
  choiceWrongBg: "rgba(137, 72, 66, 0.16)",
  choiceWrongText: "#7b4a45",
  matchedText: "#6c7f98",
  matchedBg: "rgba(87, 101, 116, 0.12)",
  matchedBorder: "rgba(43, 65, 96, 0.12)",
  recentMatchBg: "rgba(125, 143, 98, 0.14)",
  recentMatchBorder: "#7d8f62",
  actionBg: "#2b4160",
  actionInset: "#1f3148",
  actionText: "#dcd8c8",
  actionDisabledBg: "rgba(93, 107, 123, 0.48)",
  actionDisabledText: "rgba(226, 236, 245, 0.32)",
  successBg: "rgba(95, 121, 72, 0.18)",
  successBorder: "rgba(125, 151, 96, 0.3)",
  errorBg: "rgba(126, 73, 68, 0.18)",
  errorBorder: "rgba(181, 123, 116, 0.28)",
};

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

function speakPrompt(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.8;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
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
  const spokenFallback = entry?.fallbackText ?? fallbackText;

  if (typeof window === "undefined") {
    return;
  }

  if (entry?.src) {
    void audioService.play(entry.src, entry.src).catch(() => {
      speakPrompt(spokenFallback);
    });
    return;
  }

  speakPrompt(spokenFallback);
}

function IconSpeaker({ size = 26 }: { size?: number }) {
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
  const outcomeRingBorder = isFailure ? "rgba(125, 74, 69, 0.2)" : "rgba(43, 65, 96, 0.14)";
  const outcomeOuterBackground = isFailure
    ? "radial-gradient(circle at center, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0) 70%), linear-gradient(180deg, rgba(236, 224, 214, 0.94) 0%, rgba(223, 203, 191, 0.78) 100%)"
    : "radial-gradient(circle at center, rgba(255, 255, 255, 0.38), rgba(255, 255, 255, 0) 70%), linear-gradient(180deg, rgba(235, 230, 218, 0.92) 0%, rgba(221, 214, 198, 0.72) 100%)";
  const outcomeInnerBorder = isFailure ? "rgba(125, 74, 69, 0.11)" : "rgba(43, 65, 96, 0.08)";
  const outcomeCoreBackground = isFailure
    ? "linear-gradient(180deg, #8c5e57 0%, #70443f 100%)"
    : "linear-gradient(180deg, #40597a 0%, #2b4160 100%)";
  const outcomeCoreShadow = isFailure
    ? "inset 0 -8px 0 rgba(79, 45, 40, 0.22), 0 8px 18px rgba(112, 68, 63, 0.14)"
    : "inset 0 -8px 0 rgba(20, 32, 48, 0.24), 0 8px 18px rgba(43, 65, 96, 0.12)";
  const outcomeKickerColor = isFailure ? "rgba(112, 68, 63, 0.7)" : "rgba(43, 65, 96, 0.62)";
  const outcomeSubtitleColor = isFailure ? "rgba(112, 68, 63, 0.72)" : "rgba(43, 65, 96, 0.62)";

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
          border: 2px solid ${outcomeRingBorder};
        }

        .lesson-outcome-ring-outer {
          inset: 0;
          background: ${outcomeOuterBackground};
          box-shadow: 0 18px 36px rgba(43, 65, 96, 0.1);
        }

        .lesson-outcome-ring-inner {
          inset: 14px;
          border: 10px solid ${outcomeInnerBorder};
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
          color: ${outcomeKickerColor};
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
          color: ${outcomeSubtitleColor};
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
  const footerShellMinHeight = compactPhone ? (tinyPhone ? 66 : ultraCompactPhone ? 114 : 124) : 156;
  const promptRowHeight = compactPhone ? (tinyPhone ? 56 : ultraCompactPhone ? 70 : 82) : 116;
  const slidePanelGap = compactPhone ? (tinyPhone ? 12 : ultraCompactPhone ? 14 : 16) : 20;
  const desktopSlideViewportHeight = 520;

  const onCheck = () => {
    if (!selectedChoice || exercise.kind === "matching-pairs") return;

    const correct = selectedChoice === exercise.answer;
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
    const nextIndex = exerciseIndex + 1;
    const nextExercise = exerciseQueue[nextIndex] ?? null;

    if (nextIndex >= exerciseQueue.length) {
      playLessonAudio(audioContextId, "lesson-complete", "");
      clearStepFailed(lesson.id, step.id);
      markStepCompleted(lesson.id, step.id);
      setSelectedChoice(null);
      setActivePairSelection(null);
      setMatchedPairTileIds([]);
      setMismatchedPairTileIds([]);
      setRecentlyMatchedPairTileIds([]);
      setResultState("idle");
      setIncomingExerciseIndex(null);
      setIsSliding(false);
      setLifeSpentOnCurrentExercise(false);
      setCompletionMessage(COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)]);
      setIsCelebratingCompletion(true);
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
                  ? "rgba(226, 236, 245, 0.42)"
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
                lineHeight: 1.08,
                margin: 0,
                color: LESSON_THEME.textPrimary,
                fontWeight: 800,
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
              lineHeight: 1.08,
              margin: 0,
                color: LESSON_THEME.textPrimary,
              fontWeight: 800,
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
              alignContent: "start",
              alignItems: "start",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", minHeight: 0 }}>
              <button
                type="button"
                className="lesson-tap-target lesson-audio-card"
                onClick={() => {
                  if (panelExerciseAudioId) {
                    playLessonAudio(audioContextId, panelExerciseAudioId, panelExerciseAudioFallback);
                    return;
                  }

                  if (targetExercise.kind !== "hear-and-choose") {
                    speakPrompt(targetExercise.display);
                  }
                }}
                style={{
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
                }}
              >
                {panelCardLabel ? (
                  <span
                    className={panelCardLabelIsCoptic ? "coptic-text" : undefined}
                    style={{
                      fontSize: cardLabelFontSize,
                      lineHeight: 1,
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    {panelCardLabel}
                  </span>
                ) : (
                  <span style={{ transform: `scale(${speakerScale})` }}>
                    <IconSpeaker size={compactPhone ? 30 : 38} />
                  </span>
                )}

                <span style={{ position: "absolute", right: compactPhone ? 16 : 24, bottom: compactPhone ? 14 : 20 }}>
                  <IconSpeaker size={compactPhone ? 28 : 38} />
                </span>
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: panelShowChoiceGrid ? "repeat(2, minmax(0, 1fr))" : "1fr",
                gap: gridGap,
                minHeight: 0,
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
              <button
                type="button"
                className="lesson-tap-target lesson-audio-card"
                onClick={() => {
                  if (panelExerciseAudioId) {
                    playLessonAudio(audioContextId, panelExerciseAudioId, panelExerciseAudioFallback);
                    return;
                  }

                  if (targetExercise.kind !== "hear-and-choose") {
                    speakPrompt(targetExercise.display);
                  }
                }}
                style={{
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
                }}
              >
                {panelCardLabel ? (
                  <span
                    className={panelCardLabelIsCoptic ? "coptic-text" : undefined}
                    style={{
                      fontSize: cardLabelFontSize,
                      lineHeight: 1,
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    {panelCardLabel}
                  </span>
                ) : (
                  <span style={{ transform: `scale(${speakerScale})` }}>
                    <IconSpeaker size={compactPhone ? 30 : 38} />
                  </span>
                )}

                <span style={{ position: "absolute", right: compactPhone ? 16 : 24, bottom: compactPhone ? 14 : 20 }}>
                  <IconSpeaker size={compactPhone ? 28 : 38} />
                </span>
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: panelShowChoiceGrid ? "repeat(2, minmax(0, 1fr))" : "1fr",
                gap: gridGap,
                minHeight: 0,
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

export default function LessonClient({
  lesson,
  step,
}: {
  lesson: Lesson;
  step: UnitLessonStep;
}) {
  if (step.exerciseSet === "section-1-unit-2-group-1-lesson-1") {
    return <Section1Unit2Lesson1Client lesson={lesson} step={step} />;
  }

  if (step.exerciseSet === "section-1-unit-2-group-1-lesson-2") {
    return <Section1Unit2Lesson2Client lesson={lesson} step={step} />;
  }

  if (!step.exerciseSet) {
    return <PlaceholderLesson lesson={lesson} step={step} />;
  }

  if (step.exerciseSet in LESSON_EXERCISE_SETS) {
    return <PairLettersLesson lesson={lesson} step={step as UnitLessonStep & { exerciseSet: keyof typeof LESSON_EXERCISE_SETS }} />;
  }

  return <GenericLesson lesson={lesson} />;
}
