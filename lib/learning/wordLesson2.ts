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
      acceptedAnswers?: string[];
      prompt: string;
      audio: string;
      choices: string[];
      answer: string;
      audioId: string;
    }
  | {
      id: string;
      kind: "word_bank";
      prompt: string;
      text: string;
      choices: string[];
      answer: string;
      audioId: string;
      audioOnly?: boolean;
      newWord: true;
    };

export const COPTIC = {
  ma: "\u2C99\u2C81",
  me: "\u2C99\u2C89",
  mo: "\u2C99\u2C9F",
  po: "\u2CA1\u2C9F",
  na: "\u2C9B\u2C81",
  ne: "\u2C9B\u2C89",
  se: "\u2CA5\u2C89",
  ria: "\u2CA3\u2C93\u2C81",
  kai: "\u2C95\u2C81\u2C93",
  tia: "\u2CA7\u2C93\u2C81",
  moi: "\u2C99\u2C9F\u2C93",
  boi: "\u2C83\u2C9F\u2C93",
  ba: "\u2C83\u2C81",
  anna: "\u2C80\u2C9B\u2C9B\u2C81",
  maria: "\u2C98\u2C81\u2CA3\u2C93\u2C81",
  markos: "\u2C98\u2C81\u2CA3\u2C95\u2C9F\u2CA5",
  seAnna: "\u2CA4\u2C89 \u2C80\u2C9B\u2C9B\u2C81",
  seMaria: "\u2CA5\u2C89, \u2C98\u2C81\u2CA3\u2C93\u2C81",
  annaNemMarkos: "\u2C80\u2C9B\u2C9B\u2C81 \u2C9B\u2C89\u2C99 \u2C98\u2C81\u2CA3\u2C95\u2C9F\u2CA5",
  piMiniMarket: "\u2CA1\u2C93 \u2C99\u2C93\u2C9B\u2C93 \u2C99\u2C81\u2CA3\u2C95\u2C89\u2CA7",
  piMoou: "\u2CA1\u2C93 \u2C99\u2C9F\u2C9F\u2CA9",
} as const;

export const QUESTIONS: LessonQuestion[] = [
  {
    id: "u2l2-1",
    kind: "sound_mcq",
    prompt: "What sound does this make?",
    text: COPTIC.se,
    choices: ["na", "ma", "se"],
    answer: "se",
    audioId: "se",
  },
  {
    id: "u2l2-7",
    kind: "letter_mcq",
    prompt: 'Select the correct letters for "se"',
    sound: "se",
    choices: [COPTIC.na, COPTIC.moi, COPTIC.se, COPTIC.boi],
    answer: COPTIC.se,
    audioId: "se",
  },
  {
    id: "u2l2-1-listen",
    kind: "listening_mcq",
    prompt: "What do you hear?",
    audio: "se",
    choices: ["na", "ma", "se"],
    answer: "se",
    audioId: "se",
  },
  {
    id: "u2l2-2",
    kind: "listening_mcq",
    prompt: "What do you hear?",
    audio: "se",
    choices: ["se", "ria", "ma", "ro"],
    answer: "se",
    audioId: "se",
  },
  {
    id: "u2l2-3",
    kind: "sound_mcq",
    prompt: "What sound does this make?",
    text: COPTIC.ria,
    choices: ["kai", "ria", "ro"],
    answer: "ria",
    audioId: "ria",
  },
  {
    id: "u2l2-8",
    kind: "letter_mcq",
    prompt: 'Select the correct letters for "ria"',
    sound: "ria",
    choices: [COPTIC.po, COPTIC.kai, COPTIC.ria, COPTIC.tia],
    answer: COPTIC.ria,
    audioId: "ria",
  },
  {
    id: "u2l2-4",
    kind: "listening_mcq",
    prompt: "What do you hear?",
    audio: "ria",
    choices: ["tia", "po", "ria", "kai"],
    answer: "ria",
    audioId: "ria",
  },
  {
    id: "u2l2-5",
    kind: "listening_mcq",
    prompt: "What do you hear?",
    audio: "ria",
    choices: ["ma", "se", "na", "ria"],
    answer: "ria",
    audioId: "ria",
  },
  {
    id: "u2l2-6-sound",
    kind: "sound_mcq",
    prompt: "What sound does this make?",
    text: COPTIC.ma,
    choices: ["ma", "na", "ne"],
    answer: "ma",
    audioId: "ma",
  },
  {
    id: "u2l2-6-listen-a",
    kind: "listening_mcq",
    prompt: "What do you hear?",
    audio: "ma",
    choices: ["na", "ria", "se", "ma"],
    answer: "ma",
    audioId: "ma",
  },
  {
    id: "u2l2-6",
    kind: "listening_mcq",
    prompt: "What do you hear?",
    audio: "ma",
    choices: ["va", "mo", "ma", "ve"],
    answer: "ma",
    audioId: "ma",
  },
  {
    id: "u2l2-9",
    kind: "letter_mcq",
    prompt: 'Select the correct letters for "ma"',
    sound: "ma",
    choices: [COPTIC.ma, COPTIC.ne, COPTIC.me, COPTIC.ba],
    answer: COPTIC.ma,
    audioId: "ma",
  },
  {
    id: "u2l2-10",
    kind: "listening_mcq",
    prompt: "Translate this phrase",
    audio: COPTIC.anna,
    choices: ["Anna", "Mark", "yes", "big"],
    answer: "Anna",
    audioId: COPTIC.anna,
  },
  {
    id: "u2l2-11",
    kind: "listening_mcq",
    prompt: "Translate this phrase",
    audio: "se Anna",
    choices: ["yes Anna", "yeah Anna"],
    answer: "yes Anna",
    acceptedAnswers: ["yes Anna", "yeah Anna"],
    audioId: "se Anna",
  },
  {
    id: "u2l2-12",
    kind: "word_bank",
    prompt: "Build the meaning of this phrase",
    text: COPTIC.seMaria,
    choices: ["yes", "Maria", "Anna", "Mark"],
    answer: "yes Maria",
    audioId: "",
    newWord: true,
  },
  {
    id: "u2l2-13",
    kind: "word_bank",
    prompt: "Translate this phrase",
    text: COPTIC.annaNemMarkos,
    choices: ["Anna", "and", "Mark", "mini", "the", "water"],
    answer: "Anna and Mark",
    audioId: COPTIC.annaNemMarkos,
    audioOnly: true,
    newWord: true,
  },
  {
    id: "u2l2-14",
    kind: "word_bank",
    prompt: "Translate this phrase",
    text: COPTIC.piMiniMarket,
    choices: ["the", "mini", "market", "rice", "water", "yes"],
    answer: "the mini market",
    audioId: COPTIC.piMiniMarket,
    audioOnly: true,
    newWord: true,
  },
  {
    id: "u2l2-15",
    kind: "word_bank",
    prompt: "Translate this phrase",
    text: COPTIC.piMoou,
    choices: ["the", "water", "yes", "Anna", "Maria", "Mark"],
    answer: "the water",
    audioId: COPTIC.piMoou,
    audioOnly: true,
    newWord: true,
  },
];

