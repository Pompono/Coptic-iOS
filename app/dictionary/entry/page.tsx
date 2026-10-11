"use client";
import { useEffect, useState } from "react";
import DictionaryEntryClient from "./DictionaryEntryClient";

export default function DictionaryEntryPage() {
  const [lemma, setLemma] = useState<string | null>(null);
  useEffect(() => {
    setLemma(new URLSearchParams(window.location.search).get("lemma") ?? "");
  }, []);
  return lemma === null ? <main>Loading entry…</main> : <DictionaryEntryClient lemma={lemma} />;
}
