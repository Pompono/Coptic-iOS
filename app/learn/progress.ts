"use client";
import { LEARNING_KEY } from "@/lib/learning/progress.mjs";

const STORAGE_PREFIX = "coptic-unit-progress:";
const FAILED_STORAGE_PREFIX = "coptic-unit-failed-steps:";

export function getUnitProgressStorageKey(unitId: string) {
  return `${STORAGE_PREFIX}${unitId}`;
}

export function getUnitFailedStepsStorageKey(unitId: string) {
  return `${FAILED_STORAGE_PREFIX}${unitId}`;
}

export function readCompletedSteps(unitId: string) {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(getUnitProgressStorageKey(unitId));
    if (!raw) {
      return [] as string[];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [] as string[];
  }
}

export function writeCompletedSteps(unitId: string, stepIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getUnitProgressStorageKey(unitId), JSON.stringify([...new Set(stepIds)]));
}

export function readFailedSteps(unitId: string) {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(getUnitFailedStepsStorageKey(unitId));
    if (!raw) {
      return [] as string[];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [] as string[];
  }
}

export function writeFailedSteps(unitId: string, stepIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const next = [...new Set(stepIds)];
  if (next.length === 0) {
    window.localStorage.removeItem(getUnitFailedStepsStorageKey(unitId));
    return;
  }

  window.localStorage.setItem(getUnitFailedStepsStorageKey(unitId), JSON.stringify(next));
}

export function markStepCompleted(unitId: string, stepId: string) {
  const current = readCompletedSteps(unitId);
  if (current.includes(stepId)) {
    return current;
  }

  const next = [...current, stepId];
  writeCompletedSteps(unitId, next);
  return next;
}

export function markStepFailed(unitId: string, stepId: string) {
  const current = readFailedSteps(unitId);
  if (current.includes(stepId)) {
    return current;
  }

  const next = [...current, stepId];
  writeFailedSteps(unitId, next);
  return next;
}

export function clearStepFailed(unitId: string, stepId: string) {
  const current = readFailedSteps(unitId);
  if (!current.includes(stepId)) {
    return current;
  }

  const next = current.filter((entry) => entry !== stepId);
  writeFailedSteps(unitId, next);
  return next;
}

export function clearAllUnitProgress() {
  if (typeof window === "undefined") {
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX) || key?.startsWith(FAILED_STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  window.localStorage.removeItem(LEARNING_KEY);
  window.dispatchEvent(new Event("coptic-learning-change"));
  keysToRemove.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}
