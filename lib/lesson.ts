export type ExerciseSetId =
  | "bohairic-noun-phrases"
  | "bohairic-names-and-phrases"
  | "bohairic-first-reading-checkpoint"
  | "a-o-d-letters-and-sounds"
  | "pair-letters-and-sounds"
  | "r-letters-and-sounds"
  | "w-y-semi-vowels"
  | "arabic-coptic-bridge"
  | "section-1-unit-2-group-1-lesson-1"
  | "section-1-unit-2-group-1-lesson-2"
  | "section-1-unit-1-group-2-lesson-1"
  | "section-1-unit-1-group-2-lesson-2"
  | "section-1-unit-1-group-2-lesson-3"
  | "section-1-unit-1-group-2-lesson-4"
  | "section-1-unit-1-group-2-lesson-5"
  | "section-1-unit-1-group-3-lesson-1"
  | "section-1-unit-1-group-3-lesson-2"
  | "section-1-unit-1-group-3-lesson-3"
  | "section-1-unit-1-group-3-lesson-4"
  | "section-1-unit-1-group-3-lesson-5"
  | "section-1-unit-1-group-4-lesson-1"
  | "section-1-unit-1-group-4-lesson-2"
  | "section-1-unit-1-group-4-lesson-3"
  | "section-1-unit-1-group-4-lesson-4"
  | "section-1-unit-1-group-4-lesson-5"
  | "section-1-unit-1-group-5-lesson-1"
  | "section-1-unit-1-group-5-lesson-2"
  | "section-1-unit-1-group-5-lesson-3"
  | "section-1-unit-1-group-5-lesson-4"
  | "section-1-unit-1-group-5-lesson-5"
  | "section-1-unit-1-review"
  | "section-1-unit-1-group-1-review"
  | "section-1-unit-1-group-2-review";

export type LessonStep = {
  id: string;
  prompt: string;
  answer: string;
};

export type UnitLessonStep = {
  id: string;
  title: string;
  summary: string;
  exerciseSet?: ExerciseSetId;
};

export type UnitProgressGroup = {
  id: string;
  kind: "lesson-group" | "review";
  title: string;
  subtitle: string;
  totalLessons: number;
  unlockAfterGroupId?: string;
  lessons: UnitLessonStep[];
  reviewStep?: UnitLessonStep;
};

export type Lesson = {
  id: string;
  title: string;
  sectionId: string;
  sectionTitle: string;
  unitNumber: number;
  summary: string;
  isPlaceholder?: boolean;
  exerciseSet?: ExerciseSetId;
  steps: LessonStep[];
  progressionGroups?: UnitProgressGroup[];
};

export type LessonSection = {
  id: string;
  title: string;
  subtitle: string;
  lessons: Lesson[];
};

const COURSE_BLUEPRINT = [
  {
    id: "section-1",
    title: "Section 1",
    subtitle: "Rookie",
    units: [
      "Pair letters and sounds",
      "Identify names",
      "Refer to places",
      "Talk about your house",
      "Describe things",
      "Describe people",
      "Say where you are from",
      "Describe possessions",
      "Talk about countries",
      "Use basic phrases",
      "Form feminine adjectives",
      "Identify professions",
      "Describe universities",
      "Form questions",
      "Describe your family",
      "Introduce yourself",
    ],
  },
  {
    id: "section-2",
    title: "Section 2",
    subtitle: "Explorer",
    units: [
      "Use present tense",
      "Talk about your family",
      "Discuss clothing",
      "Describe your house",
      "Name personal items",
      "Describe an office",
      "Refer to food",
      "Describe a picture",
      "Talk about your hobbies",
      "Identify the weather",
      "Discuss geography",
      "Use prepositions",
      "Express a problem",
      "Count from 0 to 10",
      "Discuss geography",
      "Greet people",
      "Talk about what you do",
      "Tell time",
      "Describe your hobbies",
      "Express food preferences",
      "Find a bus station",
      "Talk about a market",
      "Talk on the phone",
      "Describe personalities",
      "Check into a hotel",
      "Describe symptoms",
      "Buy food",
      "Describe your ideal job",
      "Talk about daily life",
      "Discuss clothing",
      "Plan activities",
    ],
  },
] as const;

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makePlaceholderStep(groupId: string, lessonNumber: number, title: string): UnitLessonStep {
  return {
    id: `${groupId}-lesson-${lessonNumber}`,
    title: `Lesson ${lessonNumber}`,
    summary: `${title} lesson ${lessonNumber} is scaffolded and ready for content.`,
  };
}

function makeDefaultProgressionGroups(title: string): UnitProgressGroup[] {
  const groupTitle = title;

  return [
    {
      id: "group-1",
      kind: "lesson-group",
      title: groupTitle,
      subtitle: "Lesson group 1",
      totalLessons: 5,
      lessons: Array.from({ length: 5 }, (_, index) => makePlaceholderStep("group-1", index + 1, groupTitle)),
    },
    {
      id: "group-2",
      kind: "lesson-group",
      title: groupTitle,
      subtitle: "Lesson group 2",
      totalLessons: 5,
      unlockAfterGroupId: "group-1",
      lessons: Array.from({ length: 5 }, (_, index) => makePlaceholderStep("group-2", index + 1, groupTitle)),
    },
    {
      id: "group-3",
      kind: "lesson-group",
      title: groupTitle,
      subtitle: "Lesson group 3",
      totalLessons: 5,
      unlockAfterGroupId: "group-2",
      lessons: Array.from({ length: 5 }, (_, index) => makePlaceholderStep("group-3", index + 1, groupTitle)),
    },
    {
      id: "group-4",
      kind: "lesson-group",
      title: groupTitle,
      subtitle: "Lesson group 4",
      totalLessons: 5,
      unlockAfterGroupId: "group-3",
      lessons: Array.from({ length: 5 }, (_, index) => makePlaceholderStep("group-4", index + 1, groupTitle)),
    },
    {
      id: "group-5",
      kind: "lesson-group",
      title: groupTitle,
      subtitle: "Lesson group 5",
      totalLessons: 5,
      unlockAfterGroupId: "group-4",
      lessons: Array.from({ length: 5 }, (_, index) => makePlaceholderStep("group-5", index + 1, groupTitle)),
    },
    {
      id: "review",
      kind: "review",
      title: "Unit 1 review",
      subtitle: "Review everything learned in this unit",
      totalLessons: 1,
      unlockAfterGroupId: "group-5",
      lessons: [
        {
          id: "unit-1-review-final",
          title: "Unit 1 review",
          summary: "Assessment scaffold ready for the Unit 1 review lesson.",
        },
      ],
    },
  ];
}

function makePlaceholderLesson(
  sectionId: string,
  sectionTitle: string,
  unitNumber: number,
  title: string
): Lesson {
  const unitSlug = slugify(title);

  return {
    id: `${sectionId}-unit-${String(unitNumber).padStart(2, "0")}-${unitSlug}`,
    title: `Unit ${unitNumber}: ${title}`,
    sectionId,
    sectionTitle,
    unitNumber,
    summary: `Skeleton unit based on the Duolingo Arabic unit name "${title}".`,
    isPlaceholder: true,
    steps: [
      {
        id: "placeholder",
        prompt: "Lesson content coming soon.",
        answer: "",
      },
    ],
    progressionGroups: makeDefaultProgressionGroups(title),
  };
}

export const lessonSections: LessonSection[] = COURSE_BLUEPRINT.map((section) => ({
  id: section.id,
  title: section.title,
  subtitle: section.subtitle,
  lessons: section.units.map((title, index) =>
    makePlaceholderLesson(section.id, section.title, index + 1, title)
  ),
}));

const firstSection = lessonSections[0];
const firstUnit = firstSection?.lessons[0];

if (firstUnit?.progressionGroups) {
  firstUnit.summary =
    "A unit progression map with grouped lesson islands for basic sound drills and a review gate.";
  firstUnit.isPlaceholder = false;

  const firstGroup = firstUnit.progressionGroups[0];
  const secondGroup = firstUnit.progressionGroups[1];
  const thirdGroup = firstUnit.progressionGroups[2];
  const fourthGroup = firstUnit.progressionGroups[3];
  const fifthGroup = firstUnit.progressionGroups[4];
  const unitReviewGroup = firstUnit.progressionGroups[5];
  firstGroup.lessons[0] = {
    id: "lesson-1-a-o-d",
    title: "Lesson 1",
    summary: "Start with a, o, d, and their first letter combinations.",
    exerciseSet: "a-o-d-letters-and-sounds",
  };
  firstGroup.lessons[1] = {
    id: "lesson-2-foundations",
    title: "Lesson 2",
    summary: "Match the first basic Coptic letter-and-sound pairs.",
    exerciseSet: "pair-letters-and-sounds",
  };
  firstGroup.lessons[2] = {
    id: "lesson-3-r-letters",
    title: "Lesson 3",
    summary: "Continue with ra, ri, rod, and zar sound combinations.",
    exerciseSet: "r-letters-and-sounds",
  };
  firstGroup.lessons[3] = {
    id: "lesson-4-semivowels",
    title: "Lesson 4",
    summary: "Practice Coptic semivowels with \u2C9F\u2CA9\u2C81 (ouwa), \u2C9F\u2CA9, \u2C93\u2C81, \u2C81\u2C93, and \u2C81\u2CA9.",
    exerciseSet: "w-y-semi-vowels",
  };
  firstGroup.lessons[4] = {
    id: "lesson-5-arabic-bridge",
    title: "Lesson 5",
    summary:
      "Bridge Arabic-script letter groups to the app transliteration: a, dha, dhad, dhou, dhoud, ou, ouwa, ouwi, rav, and rai.",
    exerciseSet: "arabic-coptic-bridge",
  };
  firstGroup.reviewStep = {
    id: "group-1-review",
    title: "Group 1 review",
    summary: "Review the first five lessons with mixed Coptic listening, matching, and letter drills.",
    exerciseSet: "section-1-unit-1-group-1-review",
  };

  secondGroup.lessons[0] = {
    id: "lesson-6-a-ou-da",
    title: "Lesson 6",
    summary: "Start group 2 with Coptic drills for e, ee, ve, vee, ke, and kee.",
    exerciseSet: "section-1-unit-1-group-2-lesson-1",
  };
  secondGroup.lessons[1] = {
    id: "lesson-7-a-ou-da",
    title: "Lesson 7",
    summary: "Continue group 2 with Coptic-only drills for vi, i, pa, pi, po, and pod.",
    exerciseSet: "section-1-unit-1-group-2-lesson-2",
  };
  secondGroup.lessons[2] = {
    id: "lesson-8-r-letters",
    title: "Lesson 8",
    summary: "Blend new drills for ti, te, tee, mi, me, and mee with quick vi and pi review.",
    exerciseSet: "section-1-unit-1-group-2-lesson-3",
  };
  secondGroup.lessons[3] = {
    id: "lesson-9-semivowels",
    title: "Lesson 9",
    summary: "Continue with na, ne, ni, la, le, and li, plus a few review pairings from lesson 8.",
    exerciseSet: "section-1-unit-1-group-2-lesson-4",
  };
  secondGroup.lessons[4] = {
    id: "lesson-10-group-2-review",
    title: "Lesson 10",
    summary: "Finish group 2 with mixed review drills from lessons 6-9, recycling the recent vowel and consonant patterns.",
    exerciseSet: "section-1-unit-1-group-2-lesson-5",
  };
  secondGroup.reviewStep = {
    id: "group-2-review",
    title: "Group 2 review",
    summary: "Review lessons 6-10 with mixed Coptic listening, matching, and letter drills.",
    exerciseSet: "section-1-unit-1-group-2-review",
  };
  thirdGroup.lessons[0] = {
    id: "lesson-11-g-s-bridge",
    title: "Lesson 11",
    summary: "Start group 3 with gha, sa, ge, and se, plus a light first look at lone \u2CA9 as ee.",
    exerciseSet: "section-1-unit-1-group-3-lesson-1",
  };
  thirdGroup.lessons[1] = {
    id: "lesson-12-g-s-bridge",
    title: "Lesson 12",
    summary: "Keep drilling gi, si, gha, and ge while lightly reusing lone \u2CA9 with gee and see.",
    exerciseSet: "section-1-unit-1-group-3-lesson-2",
  };
  thirdGroup.lessons[2] = {
    id: "lesson-13-th-f-bridge",
    title: "Lesson 13",
    summary: "Shift to tha, fa, the, and fe, with a light first look at \u2CB1 as oh.",
    exerciseSet: "section-1-unit-1-group-3-lesson-3",
  };
  thirdGroup.lessons[3] = {
    id: "lesson-14-th-f-bridge",
    title: "Lesson 14",
    summary: "Keep drilling thi, fi, tha, and fa while lightly reusing \u2CB1 with thoh and foh.",
    exerciseSet: "section-1-unit-1-group-3-lesson-4",
  };
  thirdGroup.lessons[4] = {
    id: "lesson-15-group-3-review",
    title: "Lesson 15",
    summary: "Run a longer mixed review of lessons 11-14, covering the new consonants and both bridge-letter patterns together.",
    exerciseSet: "section-1-unit-1-group-3-lesson-5",
  };
  fourthGroup.lessons[0] = {
    id: "lesson-16-sh-f-bridge",
    title: "Lesson 16",
    summary: "Start group 4 with sha, fa, she, and fe, plus a light first look at \u2C9D with ksa.",
    exerciseSet: "section-1-unit-1-group-4-lesson-1",
  };
  fourthGroup.lessons[1] = {
    id: "lesson-17-sh-f-bridge",
    title: "Lesson 17",
    summary: "Keep drilling shi, fi, sha, and fa while lightly reusing \u2C9D with ksa and ksi.",
    exerciseSet: "section-1-unit-1-group-4-lesson-2",
  };
  fourthGroup.lessons[2] = {
    id: "lesson-18-h-kh-bridge",
    title: "Lesson 18",
    summary: "Shift to ha, kha, he, and khe, while lightly reusing \u2C9D with ksa.",
    exerciseSet: "section-1-unit-1-group-4-lesson-3",
  };
  fourthGroup.lessons[3] = {
    id: "lesson-19-h-kh-bridge",
    title: "Lesson 19",
    summary: "Keep drilling hi, khi, ha, and kha while lightly reusing \u2C9D with ksa and ksi.",
    exerciseSet: "section-1-unit-1-group-4-lesson-4",
  };
  fourthGroup.lessons[4] = {
    id: "lesson-20-group-4-review",
    title: "Lesson 20",
    summary: "Finish group 4 with a longer mixed review of lessons 16-19, covering both consonant pairs and the x bridge patterns together.",
    exerciseSet: "section-1-unit-1-group-4-lesson-5",
  };
  fifthGroup.lessons[0] = {
    id: "lesson-21-j-ch-bridge",
    title: "Lesson 21",
    summary: "Start group 5 with ga, cha, je, and che, plus a light first look at \u2CAD with kha.",
    exerciseSet: "section-1-unit-1-group-5-lesson-1",
  };
  fifthGroup.lessons[1] = {
    id: "lesson-22-j-ch-bridge",
    title: "Lesson 22",
    summary: "Keep drilling ji, chi, ga, and cha while lightly reusing \u2CAD with kha and khi.",
    exerciseSet: "section-1-unit-1-group-5-lesson-2",
  };
  fifthGroup.lessons[2] = {
    id: "lesson-23-ps-ti-bridge",
    title: "Lesson 23",
    summary: "Start the final pair with psa, pse, and ti, plus a light reuse of \u2CAD as kha.",
    exerciseSet: "section-1-unit-1-group-5-lesson-3",
  };
  fifthGroup.lessons[3] = {
    id: "lesson-24-ps-ti-bridge",
    title: "Lesson 24",
    summary: "Keep drilling psi and ti while lightly reusing \u2CAD as khi and reviewing the earlier psa and pse patterns.",
    exerciseSet: "section-1-unit-1-group-5-lesson-4",
  };
  fifthGroup.lessons[4] = {
    id: "lesson-25-group-5-review",
    title: "Lesson 25",
    summary: "Finish group 5 with a longer mixed review of lessons 21-24, covering both final consonant pairs and the kh bridge patterns together.",
    exerciseSet: "section-1-unit-1-group-5-lesson-5",
  };
  unitReviewGroup.lessons[0] = {
    id: "unit-1-review-final",
    title: "Unit 1 review",
    summary: "Run a final mixed checkpoint across Unit 1 with every taught letter represented throughout the set.",
    exerciseSet: "section-1-unit-1-review",
  };
}

const secondUnit = firstSection?.lessons[1];

if (secondUnit?.progressionGroups) {
  secondUnit.summary =
    "A Duolingo-style introduction to early Coptic syllables, first vocabulary, and simple name recognition.";
  secondUnit.isPlaceholder = false;

  const firstGroup = secondUnit.progressionGroups[0];
  firstGroup.lessons[0] = {
    id: "lesson-1-coptic-basics",
    title: "Lesson 1",
    summary: "Practice ma, ro, mi, and pi, then meet the man, the water, Mina, and Markos.",
    exerciseSet: "section-1-unit-2-group-1-lesson-1",
  };
  firstGroup.lessons[1] = {
    id: "lesson-2-basics-2",
    title: "Lesson 2",
    summary: "Practice se, names, and short sentence building with Anna, Maria, Mark, and the water.",
    exerciseSet: "section-1-unit-2-group-1-lesson-2",
  };
  firstGroup.lessons[2] = { ...firstGroup.lessons[2], title: "Articles and nouns", summary: "Build and read the person, the water, and the name. Learn what the article adds.", exerciseSet: "bohairic-noun-phrases" };
  firstGroup.lessons[3] = { ...firstGroup.lessons[3], title: "Names together", summary: "Read Anna and Mark, and put their names together with ⲛⲉⲙ, and.", exerciseSet: "bohairic-names-and-phrases" };
  firstGroup.lessons[4] = { ...firstGroup.lessons[4], title: "First reading checkpoint", summary: "Mix names, articles, and familiar nouns in a short reading checkpoint.", exerciseSet: "bohairic-first-reading-checkpoint" };

}

export const lessons: Lesson[] = lessonSections.flatMap((section) => section.lessons);
