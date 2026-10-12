const DAY = 86400000;
export const VOCABULARY_KEY = 'coptic-vocabulary:v1';
export function cardId(word, meaning, pos = '', dialect = 'bohairic') {
  return JSON.stringify([dialect, word.normalize('NFC').toLowerCase(), pos, meaning]);
}
export function createCard({ word, meaning, pos = '', dialect = 'bohairic', context = '', source = '', audio = '' }, now = Date.now()) {
  if (!word?.trim() || !meaning?.trim()) throw new Error('A saved word needs a word and meaning.');
  return { id: cardId(word, meaning, pos, dialect), word, meaning, pos, dialect, context, source, audio,
    createdAt: now, dueAt: now, intervalDays: 0, reviews: 0, lapses: 0, streak: 0, lastReviewedAt: null };
}
export function gradeCard(card, rating, now = Date.now()) {
  if (!['again', 'hard', 'good', 'easy'].includes(rating)) throw new Error('Unknown review rating.');
  const intervalDays = rating === 'again' ? 0 : rating === 'hard' ? Math.max(1, Math.round(card.intervalDays * 1.2))
    : rating === 'easy' ? Math.max(4, Math.round(card.intervalDays * 2.5))
    : card.streak === 0 ? 1 : card.intervalDays <= 1 ? 3 : Math.max(1, Math.round(card.intervalDays * 2));
  return { ...card, intervalDays, dueAt: now + (rating === 'again' ? 600000 : intervalDays * DAY),
    reviews: card.reviews + 1, lapses: card.lapses + (rating === 'again' ? 1 : 0),
    streak: rating === 'again' ? 0 : card.streak + 1, lastReviewedAt: now };
}
export function dueCards(cards, now = Date.now()) {
  return cards.filter(card => card.dueAt <= now).sort((a, b) => b.lapses - a.lapses || a.dueAt - b.dueAt || a.createdAt - b.createdAt);
}
export function parseDeck(raw) {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.cards)) throw new Error('Saved vocabulary has an unsupported format. It has not been changed.');
  const ids = new Set();
  for (const card of data.cards) {
    if (!card || typeof card.id !== 'string' || typeof card.word !== 'string' || !card.word.trim()
      || typeof card.meaning !== 'string' || !card.meaning.trim() || ids.has(card.id)
      || !['createdAt', 'dueAt', 'intervalDays', 'reviews', 'lapses', 'streak'].every(key => Number.isFinite(card[key]) && card[key] >= 0))
      throw new Error('Saved vocabulary could not be read safely. It has not been changed.');
    ids.add(card.id);
  }
  return data.cards;
}
