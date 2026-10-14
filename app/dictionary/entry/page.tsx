"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DictionaryEntryClient from "./DictionaryEntryClient";

function EntryFromQuery() {
  const params = useSearchParams();
  return <DictionaryEntryClient lemma={params.get("lemma") ?? ""} />;
}
export default function DictionaryEntryPage() {
  return <Suspense fallback={<main>Loading entry…</main>}><EntryFromQuery /></Suspense>;
}
