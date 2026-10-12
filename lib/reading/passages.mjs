export const practicePassages = [
  {
    id: 'first-noun-phrases', title: 'First noun phrases', dialect: 'Bohairic',
    text: 'ⲡⲓⲣⲱⲙⲓ. ⲡⲓⲙⲱⲟⲩ. ⲡⲓⲣⲁⲛ.',
    translation: 'The person. The water. The name.',
    description: 'Three short practice phrases, rather than a connected story. Tap each phrase to explore its article and noun.',
    source: 'Practice phrases composed for this app from the bundled Bohairic dictionary: ⲡ- (article), ⲣⲱⲙⲓ (Crum 294b), ⲙⲱⲟⲩ (water), ⲣⲁⲛ (Crum 297b). Recordings for the first two phrases come from the existing lesson audio.',
  },
  {
    id: 'dictionary-words', title: 'Names, people, and places', dialect: 'Bohairic',
    text: 'ⲣⲁⲛ. ⲣⲱⲙⲓ. ⲙⲁ. ⲏⲣⲡ.', translation: 'Name. Person. Place. Wine.',
    description: 'A vocabulary warm-up. Compare dictionary forms and save unfamiliar words for review.',
    source: 'Bundled Bohairic dictionary: Crum 297b, 294b, 153a, and 66b respectively. These are isolated practice words, not a quotation.',
  },
];

export const grammarNotes = [
  { id: 'tense', title: 'A tense marker needs the rest of the sentence',
    text: 'The dictionary distinguishes ⲁ as a letter from a verbal prefix associated with perfect, pluperfect, and aorist constructions. Its shape alone does not identify the tense of a passage. Look at the whole verbal construction and its subject, rather than translating each prefix in isolation. This distinction is especially important when a word has several dictionary meanings.',
    source: 'Bundled Bohairic dictionary, ⲁ, verbal entry, Crum 1a: the entry lists perfect, pluperfect, and aorist uses. This note explains the dictionary evidence; it does not assign a tense to arbitrary text.' },
  { id: 'articles', title: 'An article can be attached to a noun',
    text: 'In these Bohairic practice phrases, ⲡⲓ- marks a masculine singular definite noun: ⲡⲓ + ⲣⲱⲙⲓ gives “the person”. Other definite article forms include feminine ϯ- and plural ⲛⲓ-. Recognising an initial string is only a possible analysis: the dictionary and the surrounding sentence must support it.',
    source: 'Bundled Bohairic dictionary, ⲡ-: “Definite article m.”; listed variants include ⲡⲓ-, ϯ-, and ⲛⲓ-. The form descriptions are introductory editorial notes.' },
  { id: 'forms', title: 'A dictionary form is not always the form in a sentence',
    text: 'A lemma is the dictionary headword. Listed forms can help connect a word in a passage to that headword. A final hyphen or equals sign in dictionary notation marks a bound form; it is not necessarily a character to type in the passage. The reader reports the lemma and attested forms, rather than inventing an etymological root.',
    source: 'Bundled Bohairic dictionary: ⲣⲁⲛ lists ⲣⲉⲛ- and ⲣⲉⲛ= (Crum 297b); ⲣⲱⲙⲓ lists ⲣⲉⲙ- (Crum 294b).' },
  { id: 'sentences', title: 'A noun phrase is not a complete sentence',
    text: '“The person” names something; it does not tell you what that person does. These starter phrases teach article + noun structure. A verb label in a dictionary does not by itself establish tense or who performs the action. This reader currently explains supported word forms and article patterns; it does not automatically parse an arbitrary sentence or infer its tense.',
    source: 'Introductory editorial explanation of the practice phrases. Dictionary grammatical labels are lexical descriptions, not a sentence parser.' },
];
