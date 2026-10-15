type BohExample = { sentence: string; translation: string; source?: string };
type BohairicEntryRaw = {
  word: string;
  tla_id?: string;
  entry_url?: string;
  bohairic_variants?: string[];
  pos?: string;
  scriptorium_tag?: string;
  greek_origin?: string;
  crum_ref?: string;
  etymology?: string;
  senses?: string[];
  bohairic_examples?: BohExample[];
};

type CombinedEntryRaw = {
  lemma: string;
  forms?: string[];
  pos?: string;
  gloss?: string[];
  hasGloss?: boolean;
  source?: string;
  license?: string;
};

export type Entry = {
  lemma: string;
  forms: string[];
  pos: string;
  gloss: string[];
  dialect: "boh" | "unknown";
  entryUrl?: string;
  tag?: string;
  greek?: string;
  crum?: string;
  etymology?: string;
  examples?: BohExample[];
  searchBlob: string;
  normalizedPos: string;
  hasExamples: boolean;
};

function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFKC").trim();
}

function uniqueStrings(arr: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const t = (x ?? "").toString().trim();
    if (!t) continue;
    const k = t.normalize("NFKC");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function prepareBrowseEntries(bohRaw:BohairicEntryRaw[],comboRaw:CombinedEntryRaw[]):Entry[] {
  const bohEntries: Entry[] = bohRaw.map((r) => {
    const gloss = uniqueStrings(r.senses ?? []);
    const forms = uniqueStrings([r.word, ...(r.bohairic_variants ?? [])]);

    return {
      lemma: r.word,
      forms,
      pos: r.pos ?? "",
      gloss,
      dialect: "boh",
      entryUrl: r.entry_url,
      tag: r.scriptorium_tag,
      greek: r.greek_origin,
      crum: r.crum_ref,
      etymology: r.etymology,
      examples: r.bohairic_examples ?? [],
      searchBlob: norm([r.word, ...forms, ...gloss].join(" ")),
      normalizedPos: (r.pos ?? "").trim(),
      hasExamples: !!(r.bohairic_examples && r.bohairic_examples.length > 0),
    };
  });

  const comboEntries: Entry[] = comboRaw.map((r) => {
    const gloss = uniqueStrings(r.gloss ?? []);
    const forms = uniqueStrings([r.lemma, ...(r.forms ?? [])]);

    return {
      lemma: r.lemma,
      forms,
      pos: r.pos ?? "",
      gloss,
      dialect: "unknown",
      searchBlob: norm([r.lemma, ...forms, ...gloss].join(" ")),
      normalizedPos: (r.pos ?? "").trim(),
      hasExamples: false,
    };
  });

  return [...bohEntries,...comboEntries];
}
