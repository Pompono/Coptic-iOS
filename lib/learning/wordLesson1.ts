export type ImageChoice = {
  id: string;
  label: string;
  art: "man" | "water" | "big" | "rice" | "bread";
};

export type LessonQuestion =
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

export const COPTIC = {
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

export const QUESTIONS: LessonQuestion[] = [
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
    prompt: "Translate this phrase",
    text: COPTIC.mina,
    answer: "Mina",
    audioId: COPTIC.mina,
    newWord: true,
  },
  {
    id: "u2l1-14",
    kind: "translate",
    prompt: "Translate this phrase",
    text: COPTIC.markos,
    answer: "Markos",
    acceptedAnswers: ["Markos", "markos", "Mark", "mark"],
    audioId: COPTIC.markos,
    newWord: true,
  },
  {
    id: "u2l1-15",
    kind: "word_bank",
    prompt: "Translate this phrase",
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

