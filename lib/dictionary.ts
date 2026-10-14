// lib/dictionary.ts

export type DialectBadge = "bohairic" | "unknown";

export type DictionaryExample = {
  sentence: string;
  translation?: string;
  source?: string;
};

export type DictionaryEntry = {
  id: string;

  lemma: string;
  forms: string[];
  pos?: string;

  gloss: string[]; // English-only in your filtered JSONs
  examples?: DictionaryExample[];

  dialect: DialectBadge;

  // optional metadata
  tag?: string; // e.g. scriptorium_tag
  greek?: string; // greek_origin
  entryUrl?: string;
  source?: string; // where it came from
};

type BohairicRaw = {
  word: string;
  tla_id?: string;
  entry_url?: string;
  bohairic_variants?: string[];
  pos?: string;
  scriptorium_tag?: string;
  greek_origin?: string;
  senses?: string[];
  bohairic_examples?: Array<{
    sentence: string;
    translation?: string;
    source?: string;
  }>;
};

type CombinedRaw = {
  lemma: string;
  forms?: string[];
  pos?: string;
  gloss?: string[];
  source?: string;
};

function stableHash(input: string): string {
  // small deterministic hash (djb2)
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // force unsigned
  return (h >>> 0).toString(36);
}

export function normalizeForSearch(s: string): string {
  return (s ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function toEntryFromBohairic(x: BohairicRaw): DictionaryEntry {
  const lemma = x.word?.trim() ?? "";
  const forms = Array.from(
    new Set([lemma, ...(x.bohairic_variants ?? [])].map((v) => (v ?? "").trim()).filter(Boolean))
  );

  const gloss = (x.senses ?? []).map((g) => (g ?? "").trim()).filter(Boolean);

  const examples: DictionaryExample[] | undefined =
    x.bohairic_examples && x.bohairic_examples.length
      ? x.bohairic_examples.map((e) => ({
          sentence: (e.sentence ?? "").trim(),
          translation: (e.translation ?? "").trim() || undefined,
          source: (e.source ?? "").trim() || undefined,
        }))
      : undefined;

  // Separate source senses even when their lemma, POS, URL or TLA id agree.
  // Vocabulary card IDs are independent of these lookup-only record IDs.
  const id = `boh:${x.tla_id ?? ""}:${stableHash(JSON.stringify(x))}`;

  return {
    id,
    lemma,
    forms,
    pos: x.pos?.trim() || undefined,
    gloss,
    examples,
    dialect: "bohairic",
    tag: x.scriptorium_tag?.trim() || undefined,
    greek: x.greek_origin?.trim() || undefined,
    entryUrl: x.entry_url?.trim() || undefined,
    source: "Bohairic-only dataset",
  };
}

export function toEntryFromCombined(x: CombinedRaw): DictionaryEntry {
  const lemma = (x.lemma ?? "").trim();
  const forms = Array.from(
    new Set([lemma, ...(x.forms ?? [])].map((v) => (v ?? "").trim()).filter(Boolean))
  );

  const gloss = (x.gloss ?? []).map((g) => (g ?? "").trim()).filter(Boolean);

  const idBase = `unk:${lemma}:${x.pos ?? ""}:${x.source ?? ""}:${gloss.join("|")}`;
  const id = `unk:${stableHash(idBase)}`;

  return {
    id,
    lemma,
    forms,
    pos: x.pos?.trim() || undefined,
    gloss,
    dialect: "unknown",
    source: x.source?.trim() || "Combined lexicon",
  };
}

export function buildSearchIndex(entry: DictionaryEntry) {
  // Keep it cheap: concatenate searchable fields
  const fields = [
    entry.lemma,
    entry.forms.join(" "),
    entry.pos ?? "",
    entry.gloss.join(" "),
    entry.tag ?? "",
    entry.greek ?? "",
  ];
  return normalizeForSearch(fields.join(" • "));
}

export function sortEntriesPreferBohairic(a: DictionaryEntry, b: DictionaryEntry) {
  // Bohairic first, then lemma alphabetical, then POS, then id
  const da = a.dialect === "bohairic" ? 0 : 1;
  const db = b.dialect === "bohairic" ? 0 : 1;
  if (da !== db) return da - db;

  const la = normalizeForSearch(a.lemma);
  const lb = normalizeForSearch(b.lemma);
  if (la !== lb) return la < lb ? -1 : 1;

  const pa = normalizeForSearch(a.pos ?? "");
  const pb = normalizeForSearch(b.pos ?? "");
  if (pa !== pb) return pa < pb ? -1 : 1;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}