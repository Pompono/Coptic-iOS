export default function LoadingPage() {
  return <main className="mx-auto max-w-4xl px-5 py-8" role="status" aria-live="polite">
    <p className="text-[var(--text-muted)]">Opening…</p>
    <div className="mt-6 h-24 rounded-2xl bg-[var(--surface-2)]" aria-hidden="true" />
  </main>;
}
