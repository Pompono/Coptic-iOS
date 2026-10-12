"use client";
import { VOCABULARY_KEY, parseDeck } from './schedule.mjs';
export type VocabularyCard = {
  id: string; word: string; meaning: string; pos: string; dialect: string;
  context: string; source: string; audio: string;
  createdAt: number; dueAt: number; intervalDays: number; reviews: number; lapses: number; streak: number; lastReviewedAt: number | null;
};
export function readVocabulary(): VocabularyCard[] {
  return parseDeck(localStorage.getItem(VOCABULARY_KEY));
}
export function writeVocabulary(cards: VocabularyCard[]) {
  const raw = JSON.stringify({ version: 1, cards });
  parseDeck(raw);
  localStorage.setItem(VOCABULARY_KEY, raw);
  window.dispatchEvent(new Event('coptic-vocabulary-change'));
}
