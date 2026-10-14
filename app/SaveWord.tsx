"use client";
import { useEffect, useState } from 'react';
import { createCard, cardId } from '@/lib/vocabulary/schedule.mjs';
import { readVocabulary, writeVocabulary } from '@/lib/vocabulary/store';

export default function SaveWord({ word, meaning, pos = '', dialect = 'bohairic', context = '', source = '', audio = '' }: {
  word: string; meaning: string; pos?: string; dialect?: string; context?: string; source?: string; audio?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const update = () => {
      try { setSaved(readVocabulary().some(card => card.id === cardId(word, meaning, pos, dialect))); setError(''); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'Saved vocabulary could not be loaded.'); }
    };
    update(); window.addEventListener('coptic-vocabulary-change', update); window.addEventListener('storage', update);
    return () => { window.removeEventListener('coptic-vocabulary-change', update); window.removeEventListener('storage', update); };
  }, [word, meaning, pos, dialect]);
  return <div>
    <button className="ui-secondary disabled:opacity-60" disabled={saved || !!error} onClick={() => {
      try {
        const cards = readVocabulary();
        const card = createCard({ word, meaning, pos, dialect, context, source, audio });
        if (!cards.some(item => item.id === card.id)) writeVocabulary([...cards, card]);
        setSaved(true);
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save this word.'); }
    }}>{saved ? 'Saved for review' : 'Save word for review'}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
