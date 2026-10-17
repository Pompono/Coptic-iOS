import { readRecord, writeRecord } from "./progressStorage";
type Progress = {
  xp: number;
  streak: number;
  lastCompletedDate: string | null;
  completedLessons: string[];
};

const KEY = "coptic-progress";

function createDefaultProgress(): Progress {
  return {
    xp: 0,
    streak: 0,
    lastCompletedDate: null,
    completedLessons: [],
  };
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export function getProgress(): Progress {
  if (typeof window === "undefined") {
    return createDefaultProgress();
  }

  const stored = readRecord(KEY);
  if (!stored) {
    return createDefaultProgress();
  }

  return stored;
}

export function saveProgress(progress: Progress) {
  writeRecord(KEY, progress);
}

export function addXpAndAdvanceStreak({
  lessonId,
  xpEarned,
}: {
  lessonId: string;
  xpEarned: number;
}) {
  const progress = getProgress();
  const today = getToday();

  progress.xp += xpEarned;

  if (progress.lastCompletedDate !== today) {
    progress.streak += 1;
    progress.lastCompletedDate = today;
  }

  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
  }

  saveProgress(progress);
}
