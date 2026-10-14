import { LESSON_EXERCISE_SETS } from './letterExercises';
import { QUESTIONS as WORD_ONE } from './wordLesson1';
import { QUESTIONS as WORD_TWO, COPTIC } from './wordLesson2';
import { resolveLessonAudio } from '@/lib/lessonAudio';
import { learningId } from './progress.mjs';
import type { UnitLessonStep } from '@/lib/lesson';
export type LearningItem = { word: string; meaning: string; audio?: string; pos: string; explanation: string; accepted?: string[]; unitId?: string };
const coptic = (text: string) => /[\u2c80-\u2cff\u03e2-\u03ef]/u.test(text ?? '');
const soundWords = new Map<string,string>();
for (const exercises of Object.values(LESSON_EXERCISE_SETS)) for (const exercise of exercises) {
  if (exercise.kind === 'roman-to-coptic') soundWords.set(exercise.display, exercise.answer);
  if (exercise.kind === 'sound-to-roman') soundWords.set(exercise.answer, exercise.display);
  if (exercise.kind === 'matching-pairs') exercise.pairs.forEach(pair => soundWords.set(pair.right, pair.left));
}
for (const q of [...WORD_ONE, ...WORD_TWO]) {
  if (q.kind === 'sound_mcq') soundWords.set(q.answer, q.text);
  if (q.kind === 'letter_mcq') soundWords.set(q.sound, q.answer);
}
export const nounItems: LearningItem[] = [
  { word:'ⲡⲓⲣⲱⲙⲓ', meaning:'the person', accepted:['the man'], pos:'Noun phrase', audio:resolveLessonAudio('', 'ⲡⲓⲣⲱⲙⲓ')?.src, explanation:'ⲡⲓ- is the masculine singular definite article. ⲣⲱⲙⲓ means person or man. Together they form a noun phrase.' },
  { word:'ⲡⲓⲙⲱⲟⲩ', meaning:'the water', pos:'Noun phrase', audio:resolveLessonAudio('', 'ⲡⲓⲙⲱⲟⲩ')?.src, explanation:'ⲡⲓ- supplies “the”; ⲙⲱⲟⲩ supplies “water”. Keep the article when translating this phrase.' },
  { word:'ⲡⲓⲣⲁⲛ', meaning:'the name', pos:'Noun phrase', explanation:'ⲡⲓ- means “the” in this phrase. ⲣⲁⲛ is the dictionary headword for name (Crum 297b).' },
];
export const nameItems: LearningItem[] = [
  {word:COPTIC.anna, meaning:'Anna', pos:'Name', audio:resolveLessonAudio('',COPTIC.anna)?.src, explanation:'This is the name Anna written in Coptic. A personal name is not a complete sentence.'},
  {word:COPTIC.markos, meaning:'Mark', accepted:['Markos'], pos:'Name', audio:resolveLessonAudio('',COPTIC.markos)?.src, explanation:'Markos is the Coptic form used in this course; Mark is an accepted English rendering.'},
  {word:COPTIC.annaNemMarkos, meaning:'Anna and Mark', accepted:['Anna and Markos'], pos:'Phrase', audio:resolveLessonAudio('',COPTIC.annaNemMarkos)?.src, explanation:'ⲛⲉⲙ means “and” between these names. Keep both names in their original order.'},
];
export function itemsForQuestion(q: any): LearningItem[] {
  if (q.kind === 'matching-pairs') return q.pairs.filter(pair => coptic(pair.left) || coptic(pair.right)).map(pair => coptic(pair.left) ? makeSound(pair.left, pair.right) : makeSound(pair.right, pair.left));
  const soundKind = ['roman-to-coptic','sound-to-roman','hear-and-choose','sound_mcq','letter_mcq'].includes(q.kind) || (q.kind === 'listening_mcq' && !/^Translate this (?:sentence|phrase)$/.test(q.prompt));
  if (soundKind) {
    const meaning = coptic(q.answer) ? q.display ?? q.sound ?? q.audioId : q.answer;
    const word = coptic(q.answer) ? q.answer : coptic(q.display ?? q.text ?? '') ? q.display ?? q.text : soundWords.get(meaning);
    return word ? [makeSound(word, meaning, q.audioId)] : [];
  }
  let word = q.text ?? (coptic(q.audio ?? '') ? q.audio : q.audioId === 'se Anna' ? COPTIC.seAnna : q.audioId === 'se Maria' ? COPTIC.seMaria : '');
  if (!coptic(word) || !q.answer) return [];
  const known = [...nounItems, ...nameItems].find(item => item.word.toLowerCase() === word.toLowerCase());
  return [{ word, meaning: q.meaning ?? q.answer, accepted:q.acceptedAnswers ?? known?.accepted, pos:known?.pos ?? 'Course phrase', audio:resolveLessonAudio('',q.audioId)?.src,
    explanation:known?.explanation ?? (word.toLowerCase().startsWith('ⲡⲓ') ? 'ⲡⲓ- supplies “the”. Read the noun that follows it as part of the same phrase.' : `Read the whole expression in order. Its meaning in this lesson is “${q.answer}”.`) }];
}
function makeSound(word: string, meaning: string, audioId = meaning): LearningItem {
  return {word, meaning:`Sound: ${meaning}`, audio:resolveLessonAudio('',audioId)?.src, pos:'Letter / syllable', explanation:`${Array.from(word).length > 1 ? Array.from(word).join(" + ") + " forms " + word + ". " : ""}${word} is paired with “${meaning}” in this course. Compare the written form with the recording.`};
}
export function getCourseQuestions(set: string): any[] {
  if (set === 'section-1-unit-2-group-1-lesson-1') return WORD_ONE;
  if (set === 'section-1-unit-2-group-1-lesson-2') return WORD_TWO;
  return LESSON_EXERCISE_SETS[set] ?? [];
}
export function getCourseItems(set: string): LearningItem[] {
  const items = set === 'bohairic-noun-phrases' ? nounItems : set === 'bohairic-names-and-phrases' ? nameItems : set === 'bohairic-first-reading-checkpoint' ? [...nounItems,...nameItems]
    : getCourseQuestions(set).flatMap(itemsForQuestion);
  return [...new Map(items.map(item => [learningId(item),item])).values()];
}
export function lessonNote(step: UnitLessonStep) {
  const set = step.exerciseSet ?? '';
  if (set.includes('review') || set.includes('checkpoint')) return 'Use what you have learned in a mixed checkpoint. Listen, read, and answer without looking back at the examples.';
  if (set.includes('unit-2') || set.startsWith('bohairic-')) return 'Read each phrase as a whole. Names identify people; an article and a noun work together to name something.';
  return 'Read from left to right. These spellings are the sound labels used in this course; use the recordings to hear them.';
}
