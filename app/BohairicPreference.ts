"use client";

export const BOHAIRIC_ONLY_STORAGE_KEY = "bohairic-only";

export function isBohairicOnlyEnabled(): boolean {
    if (typeof window === "undefined") {
        return true;
    }

    try { return localStorage.getItem(BOHAIRIC_ONLY_STORAGE_KEY) !== "false"; }
    catch { return true; }
}

export function setBohairicOnlyEnabled(enabled: boolean): void {
    if (typeof window === "undefined") {
        return;
    }

    localStorage.setItem(BOHAIRIC_ONLY_STORAGE_KEY, String(enabled));
}
