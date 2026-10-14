"use client";
import useSettingsLockNotice from "../../SettingsLockNotice";

import Link from "@/lib/AppLink";
import { useEffect, useMemo, useState } from "react";
import { isBohairicOnlyEnabled } from "@/app/BohairicPreference";
import { crossReferences, indexSearchEntry, normalizeSearch } from "@/lib/dictionary/search.mjs";
import SaveWord from "@/app/SaveWord";
import { resolveLessonAudio } from "@/lib/lessonAudio";

type BohExample = { sentence: string; translation: string; source?: string };
type BohairicEntryRaw = {
  word: string;
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
  crum?: string;
  etymology?: string;
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
  const {show:showLock,notice}=useSettingsLockNotice();
  const [bohairicOnly, setBohairicOnly] = useState(true);
  const [globalBohairicOnly, setGlobalBohairicOnly] = useState(true);
  useEffect(() => {
    const enabled = isBohairicOnlyEnabled();
    setGlobalBohairicOnly(enabled); setBohairicOnly(enabled);
  }, []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setState("loading");

        const bohRes = await fetch("/bohairic_dictionary.json", { cache: "no-store" });
        if (!bohRes.ok) throw new Error("Bohairic dictionary unavailable");
        const bohRaw = (await bohRes.json()) as BohairicEntryRaw[];

        const comboRes = await fetch("/coptic_dictionary_combined.json", {
          cache: "no-store",
        });
        if (!comboRes.ok) throw new Error("Combined dictionary unavailable");
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
          crum: r.crum_ref,
          etymology: r.etymology,
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
  }, [loadAttempt]);

  const searchIndex = useMemo(() => entries.map(indexSearchEntry), [entries]);

  const matches = useMemo(() => {
    const list = entries.filter((e) => e.forms.some(form => normalizeSearch(form, false) === normalizeSearch(lemma, false)));
    const filtered = bohairicOnly ? list.filter((e) => e.dialect === "boh") : list;

    // Prefer Bohairic first (so “glass” shows Bohairic entries before unknown)
    return filtered.slice().sort((a, b) => {
      if (a.dialect !== b.dialect) return a.dialect === "boh" ? -1 : 1;
      return (a.pos || "").localeCompare(b.pos || "");
    });
  }, [entries, lemma, bohairicOnly]);

  return (
    <main className="dictionary-detail min-h-screen bg-[var(--bg-color)] text-[var(--text-color)]">
      {notice}
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
            onClick={() => globalBohairicOnly ? showLock() : setBohairicOnly((v) => !v)}
            aria-disabled={globalBohairicOnly}
            title={globalBohairicOnly ? "Locked by global Bohairic-only mode in Settings" : "Toggle Bohairic-only entries"}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
              bohairicOnly
                ? "border-[var(--bohairic-badge-border)] bg-[var(--bohairic-badge-bg)] text-[var(--bohairic-badge-text)]"
                : "border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]",
            ].join(" ")}
            aria-pressed={bohairicOnly}
          >
            <span
              className={[
                "h-2.5 w-2.5 rounded-full",
                bohairicOnly ? "bg-[var(--bohairic-badge-dot)]" : "bg-[var(--text-soft)]",
              ].join(" ")}
            />
            Bohairic-only
          </button>
        </div>

        <h1 className="coptic-text mt-7 text-4xl font-semibold tracking-tight">{lemma}</h1>

        {state === "loading" ? (
          <p className="mt-4 text-[var(--text-muted)]">Loading…</p>
        ) : state === "error" ? (
          <p role="alert" className="mt-4 text-[var(--lesson-choice-wrong-text)]">Failed to load dictionary files. <button type="button" onClick={() => setLoadAttempt(n => n + 1)} className="ml-2 min-h-11 underline">Retry</button></p>
        ) : matches.length === 0 ? (
          <p className="mt-4 text-[var(--text-muted)]">No entries found for this lemma.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {matches.map((e, idx) => (
              <div
                key={`${e.dialect}-${e.lemma}-${e.pos}-${idx}`}
                className="dictionary-entry-card"
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
                            ? "border-[var(--bohairic-badge-border)] bg-[var(--bohairic-badge-bg)] text-[var(--bohairic-badge-text)]"
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
                      {e.crum || e.entryUrl?.startsWith('crum:') ? <span>Crum {e.crum || e.entryUrl?.slice(5)}</span> : /^https?:\/\//.test(e.entryUrl ?? '') ? (
                        <a
                          href={e.entryUrl}
                          className="ml-3 text-[var(--text-muted)] underline decoration-[var(--text-muted)] underline-offset-4 hover:text-[var(--text-color)]"
                          target="_blank"
                          rel="noreferrer"
                        >
                          View entry
                        </a>
                      ) : null}
                      {e.etymology && <p className="mt-2">Etymology: {e.etymology}</p>}
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

                {crossReferences(e, searchIndex).map(target => <Link key={target} href={`/dictionary/entry/?lemma=${encodeURIComponent(target)}`} className="coptic-text mt-3 inline-block mr-3 underline">See {target}</Link>)}

                {e.gloss.length > 0 && e.pos !== "Cross-reference" && <div className="mt-4 rounded-xl border border-[var(--border-color)] p-3">
                  <SaveWord word={e.lemma} meaning={e.gloss.join('; ')} pos={e.pos}
                    dialect={e.dialect === 'boh' ? 'bohairic' : 'unknown'}
                    source={e.entryUrl?.startsWith('crum:') ? `Crum ${e.entryUrl.slice(5)}` : 'Bundled dictionary'}
                    audio={resolveLessonAudio('', e.lemma)?.src} />
                  <Link href="/vocabulary/" className="mt-2 inline-block text-sm underline">Open vocabulary & review</Link>
                </div>}

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
