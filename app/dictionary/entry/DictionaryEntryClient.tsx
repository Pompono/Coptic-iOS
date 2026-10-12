"use client";

import Link from "@/lib/AppLink";
import { useEffect, useMemo, useState } from "react";

type BohExample = { sentence: string; translation: string; source?: string };
type BohairicEntryRaw = {
  word: string;
  entry_url?: string;
  bohairic_variants?: string[];
  pos?: string;
  scriptorium_tag?: string;
  greek_origin?: string;
  senses?: string[];
  bohairic_examples?: BohExample[];
};

type CombinedEntryRaw = {
  lemma: string;
  forms?: string[];
  pos?: string;
  gloss?: string[];
};

type Entry = {
  lemma: string;
  forms: string[];
  pos: string;
  gloss: string[];
  dialect: "boh" | "unknown";
  entryUrl?: string;
  tag?: string;
  greek?: string;
  examples?: BohExample[];
};

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

export default function DictionaryEntryClient({ lemma }: { lemma: string }) {
  const [bohairicOnly, setBohairicOnly] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setState("loading");

        const bohRes = await fetch("/bohairic_dictionary.json", { cache: "no-store" });
        const bohRaw = (await bohRes.json()) as BohairicEntryRaw[];

        const comboRes = await fetch("/coptic_dictionary_combined.json", {
          cache: "no-store",
        });
        const comboRaw = (await comboRes.json()) as CombinedEntryRaw[];

        const bohEntries: Entry[] = bohRaw.map((r) => ({
          lemma: r.word,
          forms: uniqueStrings([r.word, ...(r.bohairic_variants ?? [])]),
          pos: r.pos ?? "",
          gloss: uniqueStrings(r.senses ?? []),
          dialect: "boh",
          entryUrl: r.entry_url,
          tag: r.scriptorium_tag,
          greek: r.greek_origin,
          examples: r.bohairic_examples ?? [],
        }));

        const comboEntries: Entry[] = comboRaw.map((r) => ({
          lemma: r.lemma,
          forms: uniqueStrings([r.lemma, ...(r.forms ?? [])]),
          pos: r.pos ?? "",
          gloss: uniqueStrings(r.gloss ?? []),
          dialect: "unknown",
        }));

        const merged = [...bohEntries, ...comboEntries];

        if (!cancelled) {
          setEntries(merged);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(() => {
    const list = entries.filter((e) => e.lemma === lemma);
    const filtered = bohairicOnly ? list.filter((e) => e.dialect === "boh") : list;

    // Prefer Bohairic first (so “glass” shows Bohairic entries before unknown)
    return filtered.slice().sort((a, b) => {
      if (a.dialect !== b.dialect) return a.dialect === "boh" ? -1 : 1;
      return (a.pos || "").localeCompare(b.pos || "");
    });
  }, [entries, lemma, bohairicOnly]);

  return (
    <main className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dictionary"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-2 text-sm text-[var(--text-color)] hover:bg-[var(--surface-2)]"
          >
            ← Back
          </Link>

          <button
            type="button"
            onClick={() => setBohairicOnly((v) => !v)}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
              bohairicOnly
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                : "border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]",
            ].join(" ")}
            aria-pressed={bohairicOnly}
          >
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                bohairicOnly ? "bg-emerald-300" : "bg-[var(--text-soft)]",
              ].join(" ")}
            />
            Bohairic-only
          </button>
        </div>

        <h1 className="coptic-text mt-7 text-4xl font-semibold tracking-tight">{lemma}</h1>

        {state === "loading" ? (
          <p className="mt-4 text-[var(--text-muted)]">Loading…</p>
        ) : state === "error" ? (
          <p className="mt-4 text-red-300">Failed to load dictionary files.</p>
        ) : matches.length === 0 ? (
          <p className="mt-4 text-[var(--text-muted)]">No entries found for this lemma.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {matches.map((e, idx) => (
              <div
                key={`${e.dialect}-${e.lemma}-${e.pos}-${idx}`}
                className="rounded-3xl border border-[var(--border-color)] bg-[var(--surface-1)] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {e.forms.length > 1 && (
                      <div className="text-sm text-[var(--text-muted)]">
                        Forms:{" "}
                        <span className="coptic-text text-[var(--text-muted)]">
                          {e.forms.filter((x) => x !== e.lemma).join(", ")}
                        </span>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-xs",
                          e.dialect === "boh"
                            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                            : "border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-muted)]",
                        ].join(" ")}
                      >
                        {e.dialect === "boh" ? "Bohairic" : "Unknown"}
                      </span>

                      {e.pos ? (
                        <span className="rounded-full border border-[var(--border-color)] bg-[var(--surface-1)] px-3 py-1 text-xs text-[var(--text-muted)]">
                          {e.pos}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 text-sm text-[var(--text-muted)]">
                      {e.tag ? <span className="mr-3">Tag: {e.tag}</span> : null}
                      {e.greek ? <span>Greek: {e.greek}</span> : null}
                      {e.entryUrl ? (
                        <a
                          href={e.entryUrl}
                          className="ml-3 text-[var(--text-muted)] underline decoration-[var(--text-muted)] underline-offset-4 hover:text-white"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View entry
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  {e.gloss.length ? (
                    <ul className="list-disc space-y-1 pl-5 text-[var(--text-muted)]">
                      {e.gloss.map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-[var(--text-muted)]">No gloss.</div>
                  )}
                </div>

                {e.examples && e.examples.length > 0 ? (
                  <div className="mt-5">
                    <div className="text-sm font-semibold text-[var(--text-muted)]">
                      Examples
                    </div>
                    <div className="mt-3 space-y-3">
                      {e.examples.slice(0, 5).map((ex, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4"
                        >
                          <div className="coptic-text text-[var(--text-color)]">{ex.sentence}</div>
                          <div className="mt-2 text-[var(--text-muted)]">{ex.translation}</div>
                          {ex.source ? (
                            <div className="mt-2 text-xs text-[var(--text-soft)]">
                              {ex.source}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}