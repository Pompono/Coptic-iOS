"use client";
import { readRecord, writeRecord, reportProgressError } from "@/lib/progressStorage";

const STORAGE_PREFIX = "coptic-unit-progress:";
const FAILED_STORAGE_PREFIX = "coptic-unit-failed-steps:";

export function getUnitProgressStorageKey(unitId: string) {
  return `${STORAGE_PREFIX}${unitId}`;
}

export function getUnitFailedStepsStorageKey(unitId: string) {
  return `${FAILED_STORAGE_PREFIX}${unitId}`;
}

// null means unavailable; only a genuinely missing record becomes an empty list.
export function readCompletedSteps(unitId: string): string[] | null {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try { return (readRecord(getUnitProgressStorageKey(unitId)) ?? []) as string[]; }
  catch (error) { reportProgressError(error); return null; }
}

export function writeCompletedSteps(unitId: string, stepIds: string[]) {
  if (typeof window === "undefined") return;
  writeRecord(getUnitProgressStorageKey(unitId), [...new Set(stepIds)]);
}

export function readFailedSteps(unitId: string): string[] | null {
  if (typeof window === "undefined") return [];
  try { return readRecord(getUnitFailedStepsStorageKey(unitId)) ?? []; }
  catch (error) { reportProgressError(error); return null; }
}

export function writeFailedSteps(unitId: string, stepIds: string[]) {
  if (typeof window === "undefined") return;
  writeRecord(getUnitFailedStepsStorageKey(unitId), [...new Set(stepIds)]);
}

export function markStepCompleted(unitId: string, stepId: string) {
  const current: string[] = readRecord(getUnitProgressStorageKey(unitId)) ?? [];
  if (current.includes(stepId)) {
    return current;
  }

  const next = [...current, stepId];
  writeCompletedSteps(unitId, next);
  return next;
}

export function markStepFailed(unitId: string, stepId: string) {
  const current: string[] = readRecord(getUnitFailedStepsStorageKey(unitId)) ?? [];
  if (current.includes(stepId)) {
    return current;
  }

  const next = [...current, stepId];
  writeFailedSteps(unitId, next);
  return next;
}

export function clearStepFailed(unitId: string, stepId: string) {
  const current: string[] = readRecord(getUnitFailedStepsStorageKey(unitId)) ?? [];
  if (!current.includes(stepId)) {
    return current;
  }

  const next = current.filter((entry) => entry !== stepId);
  writeFailedSteps(unitId, next);
  return next;
}
