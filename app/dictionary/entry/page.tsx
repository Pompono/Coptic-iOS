"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DictionaryEntryClient from "./DictionaryEntryClient";
import PageHeader from '@/app/PageHeader';
import DelayedStatus from '@/app/DelayedStatus';

function EntryFromQuery() {
  const params = useSearchParams();
  return <DictionaryEntryClient lemma={params.get("lemma") ?? ""} />;
}
export default function DictionaryEntryPage() {
  return <Suspense fallback={<main className="app-page"><PageHeader title="Dictionary" icon="book"/><DelayedStatus>Finding this word…</DelayedStatus></main>}><EntryFromQuery /></Suspense>;
}
