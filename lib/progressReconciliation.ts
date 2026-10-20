import { lessons } from './lesson';
import type { Records } from './progressStorage';

export type ReconciliationResult =
  | { safe: true; records: Records }
  | { safe: false; reason: string };

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function setUnion(left: unknown, right: unknown) {
  if (!Array.isArray(left) || !left.every(value => typeof value === 'string')
    || !Array.isArray(right) || !right.every(value => typeof value === 'string')) return null;
  return [...new Set([...left, ...right])];
}

const curriculum = lessons;
const lessonPositions = new Map(curriculum.map((lesson, index) => [lesson.id, index]));
const lessonStepOrder = new Map(curriculum.map(lesson => [lesson.id, [
  ...(lesson.progressionGroups ?? []).flatMap(group => [
    ...group.lessons.map(step => step.id),
    ...(group.reviewStep ? [group.reviewStep.id] : []),
  ]),
  ...lesson.steps.map(step => step.id),
]]));
const lessonSteps = new Map(curriculum.map(lesson => [lesson.id, new Set([
  ...lesson.steps.map(step => step.id),
  ...(lesson.progressionGroups ?? []).flatMap(group => [
    ...group.lessons.map(step => step.id),
    ...(group.reviewStep ? [group.reviewStep.id] : []),
  ]),
])]));

export function summarizeProgress(records: Records) {
  const progress = records['coptic-progress'] ? JSON.parse(records['coptic-progress']) : { xp: 0, completedLessons: [] };
  const completed = new Set<string>(progress.completedLessons ?? []);
  let position = -1;
  let through = 'No completed lesson';
  curriculum.forEach((lesson, index) => {
    if (completed.has(lesson.id)) { position = index * 1_000_000 + 999_999; through = lesson.title; }
    const stepOrder = lessonStepOrder.get(lesson.id) ?? [];
    const completedSteps: string[] = records[`coptic-unit-progress:${lesson.id}`]
      ? JSON.parse(records[`coptic-unit-progress:${lesson.id}`]) : [];
    for (const stepId of completedSteps) {
      const stepIndex = stepOrder.indexOf(stepId);
      if (stepIndex >= 0 && index * 1_000_000 + stepIndex > position) {
        position = index * 1_000_000 + stepIndex;
        through = lesson.title;
      }
    }
  });
  const steps = Object.entries(records).filter(([key]) => key.startsWith('coptic-unit-progress:'))
    .reduce((sum, [, raw]) => sum + JSON.parse(raw).length, 0);
  return { lessons: completed.size, steps, xp: progress.xp ?? 0, position, through };
}

function mergeProgress(leftRaw: string | undefined, rightRaw: string | undefined): string | null {
  if (!leftRaw || !rightRaw) return null;
  const left = JSON.parse(leftRaw);
  const right = JSON.parse(rightRaw);
  if (left.streak !== right.streak || left.lastCompletedDate !== right.lastCompletedDate) return null;
  const completedLessons = setUnion(left.completedLessons, right.completedLessons);
  if (!completedLessons || completedLessons.some(id => !lessonPositions.has(id))) return null;
  const positions = completedLessons.map(id => lessonPositions.get(id)!).sort((a, b) => a - b);
  // Only merge contiguous pathway prefixes, so a union cannot imply a skipped prerequisite.
  if (positions.some((position, index) => position !== index)) return null;
  return JSON.stringify({ ...left, xp: Math.max(left.xp, right.xp), completedLessons });
}

function mergeStepRecord(key: string, leftRaw: string | undefined, rightRaw: string | undefined): string | null {
  if (!leftRaw || !rightRaw) return null;
  const lessonId = key.slice('coptic-unit-progress:'.length);
  const allowed = lessonSteps.get(lessonId);
  const merged = setUnion(JSON.parse(leftRaw), JSON.parse(rightRaw));
  if (!allowed || !merged || merged.some(id => !allowed.has(id))) return null;
  return JSON.stringify(merged);
}

function mergeVocabulary(leftRaw: string | undefined, rightRaw: string | undefined): string | null {
  if (!leftRaw || !rightRaw) return null;
  const left = JSON.parse(leftRaw);
  const right = JSON.parse(rightRaw);
  const cards = new Map<string, unknown>();
  for (const card of [...left.cards, ...right.cards]) {
    const previous = cards.get(card.id);
    if (previous !== undefined && !same(previous, card)) return null;
    cards.set(card.id, card);
  }
  return JSON.stringify({ ...left, cards: [...cards.values()] });
}

function mergeLearning(leftRaw: string | undefined, rightRaw: string | undefined): string | null {
  if (!leftRaw || !rightRaw) return null;
  const left = JSON.parse(leftRaw);
  const right = JSON.parse(rightRaw);
  const skills = { ...left.skills };
  for (const [id, skill] of Object.entries(right.skills)) {
    if (skills[id] !== undefined && !same(skills[id], skill)) return null;
    skills[id] = skill;
  }
  return JSON.stringify({ ...left, skills });
}

/** Merges only independent or identical records; ambiguous histories remain a user-reviewed conflict. */
export function reconcileProgressRecords(local: Records, cloud: Records): ReconciliationResult {
  try {
    const merged: Records = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(cloud)]);
    const completedAcrossCopies = new Map<string, Set<string>>();
    for (const key of keys) {
      if (!key.startsWith('coptic-unit-progress:')) continue;
      const left = local[key] ? JSON.parse(local[key]) : [];
      const right = cloud[key] ? JSON.parse(cloud[key]) : [];
      const combined = setUnion(left, right);
      if (!combined) return { safe: false, reason: 'Completed step records are invalid.' };
      completedAcrossCopies.set(key.slice('coptic-unit-progress:'.length), new Set(combined));
    }
    for (const key of keys) {
      if (!key.startsWith('coptic-unit-failed-steps:')) continue;
      const left = local[key] ? JSON.parse(local[key]) : [];
      const right = cloud[key] ? JSON.parse(cloud[key]) : [];
      const failed = setUnion(left, right);
      const lessonId = key.slice('coptic-unit-failed-steps:'.length);
      const completed = completedAcrossCopies.get(lessonId) ?? new Set<string>();
      if (!failed || failed.some(id => completed.has(id))) return { safe: false, reason: 'Practice history conflicts between completed and failed steps.' };
    }
    for (const key of keys) {
      const left = local[key];
      const right = cloud[key];
      if (left === undefined || right === undefined) {
        // Unique records are safe to preserve except the streak summary, which is coupled to XP/date.
        if (key === 'coptic-progress') return { safe: false, reason: 'A progress summary is missing from one copy.' };
        if (key.startsWith('coptic-unit-progress:')) {
          const lessonId = key.slice('coptic-unit-progress:'.length);
          const allowed = lessonSteps.get(lessonId);
          const steps = JSON.parse(left ?? right!);
          if (!allowed || !Array.isArray(steps) || steps.some(id => typeof id !== 'string' || !allowed.has(id))) {
            return { safe: false, reason: 'A completed step does not match the current curriculum.' };
          }
        }
        merged[key] = left ?? right!;
        continue;
      }
      if (left === right) { merged[key] = left; continue; }
      if (key === 'coptic-progress') {
        const value = mergeProgress(left, right);
        if (value === null) return { safe: false, reason: 'Lesson order or streak history is ambiguous.' };
        merged[key] = value;
      } else if (key.startsWith('coptic-unit-progress:')) {
        const value = mergeStepRecord(key, left, right);
        if (value === null) return { safe: false, reason: 'Completed steps do not match the current curriculum.' };
        merged[key] = value;
      } else if (key.startsWith('coptic-unit-failed-steps:')) {
        const failed = setUnion(JSON.parse(left), JSON.parse(right));
        if (!failed) return { safe: false, reason: 'Practice history is invalid.' };
        merged[key] = JSON.stringify(failed);
      } else if (key === 'coptic-vocabulary:v1') {
        const value = mergeVocabulary(left, right);
        if (value === null) return { safe: false, reason: 'A vocabulary card has different review histories.' };
        merged[key] = value;
      } else if (key === 'coptic-learning:v1') {
        const value = mergeLearning(left, right);
        if (value === null) return { safe: false, reason: 'A practiced item has different counters or review schedules.' };
        merged[key] = value;
      } else {
        // Saved passages and drafts cannot be combined without inventing content.
        return { safe: false, reason: 'Saved reading content differs between copies.' };
      }
    }
    return { safe: true, records: merged };
  } catch {
    return { safe: false, reason: 'One or both progress copies could not be safely reconciled.' };
  }
}
