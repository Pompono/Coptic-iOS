export const LEARNING_KEY = 'coptic-learning:v1';
const DAY = 86400000;
export function parseLearning(raw) {
  if (raw === null) return { version: 1, skills: {} };
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !data.skills || typeof data.skills !== 'object' || Array.isArray(data.skills)) throw new Error('Learning progress could not be read. It has not been overwritten.');
  for (const skill of Object.values(data.skills)) {
    if (!skill || typeof skill.word !== 'string' || typeof skill.meaning !== 'string' ||
      !['attempts','correct','lapses','dueAt','lastSeen','successfulDays'].every(k => Number.isFinite(skill[k]) && skill[k] >= 0)) throw new Error('Learning progress could not be read. It has not been overwritten.');
  }
  return data;
}
export function learningId(item) {
  return JSON.stringify([item.word.normalize('NFC').toLowerCase(), item.meaning.toLowerCase()]);
}
export function recordAttempt(data, item, correct, firstTry, now = Date.now()) {
  const id = learningId(item), previous = data.skills[id];
  const skill = previous ?? { word: item.word, meaning: item.meaning, unitId: item.unitId, unitIds: [item.unitId], audio: item.audio ?? '', pos: item.pos ?? '', explanation: item.explanation ?? '', accepted: item.accepted ?? [], attempts: 0, correct: 0, lapses: 0, dueAt: now, lastSeen: 0, successfulDays: 0, lastSuccessfulDay: null };
  const day = Math.floor(now / DAY), spacedSuccess = correct && firstTry && skill.lastSuccessfulDay !== day;
  const next = { ...skill, unitId: item.unitId, unitIds: [...new Set([...(skill.unitIds ?? [skill.unitId]), item.unitId].filter(Boolean))], lastSeen: now,
    needsPractice: !correct || (firstTry ? false : skill.needsPractice ?? false),
    attempts: skill.attempts + Number(firstTry), correct: skill.correct + Number(correct && firstTry),
    lapses: skill.lapses + Number(!correct && firstTry),
    successfulDays: skill.successfulDays + Number(spacedSuccess),
    lastSuccessfulDay: spacedSuccess ? day : skill.lastSuccessfulDay,
    dueAt: !correct ? now + 600000 : firstTry ? now + DAY * Math.min(14, Math.max(1, skill.successfulDays * 2)) : skill.dueAt,
  };
  return { ...data, skills: { ...data.skills, [id]: next } };
}
export function masteryState(skill) {
  if (skill?.needsPractice) return 'Needs practice';
  if (!skill?.attempts) return 'New';
  const accuracy = skill.correct / skill.attempts;
  if (accuracy < .7 || (skill.lapses > 0 && skill.successfulDays < 2)) return 'Needs practice';
  if (skill.successfulDays >= 3 && accuracy >= .85) return 'Secure';
  return 'Building';
}
export function dueLearningItems(data, knownIds, now = Date.now(), limit = 3) {
  const allowed = new Set(knownIds);
  return Object.entries(data.skills).filter(([id, item]) => allowed.has(id) && item.dueAt <= now)
    .sort((a,b) => b[1].lapses-a[1].lapses || a[1].dueAt-b[1].dueAt).slice(0,limit).map(([id,item]) => ({id,...item}));
}
