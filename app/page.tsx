import Link from "@/lib/AppLink";
import { lessons } from "@/lib/lesson";

export default function Page() {
  const firstUnit = lessons[0];
  const startLearningHref = firstUnit ? `/learn/${firstUnit.id}` : "/learn";

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto", minHeight: "var(--page-content-height)" }}>
      <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 10 }}>Coptic</h1>

      <p style={{ opacity: 0.85, marginBottom: 24 }}>
        Read, understand, and remember Coptic.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <Link href="/read/" className="rounded-xl bg-[var(--accent-color)] px-5 py-3 font-semibold text-[var(--accent-contrast-color)]">Read Coptic →</Link>
        <Link href="/vocabulary/" className="rounded-xl border border-[var(--border-color)] px-5 py-3 font-semibold">Vocabulary & review →</Link>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link
          href={startLearningHref}
          style={{
            display: "inline-block",
            padding: "12px 18px",
            borderRadius: 12,
            background: "var(--accent-color)",
            color: "var(--accent-contrast-color)",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Start Learning →
        </Link>

        <Link
          href="/dictionary"
          style={{
            display: "inline-block",
            padding: "12px 18px",
            borderRadius: 12,
            border: "1px solid var(--border-color)",
            color: "var(--text-color)",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Dictionary →
        </Link>

        <Link
          href="/translator"
          style={{
            display: "inline-block",
            padding: "12px 18px",
            borderRadius: 12,
            border: "1px solid var(--border-color)",
            color: "var(--text-color)",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Translator →
        </Link>
      </div>

      <Link
        href="/settings"
        aria-label="Open settings"
        className="mobile-chin-hide-on-mobile"
        style={{
          position: "fixed",
          right: 14,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)",
          zIndex: 20,
          width: 46,
          height: 46,
          borderRadius: 999,
          border: "1px solid var(--accent-color)",
          background: "var(--accent-color)",
          color: "var(--accent-contrast-color)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
          fontSize: 22,
          boxShadow: "0 4px 18px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.08) inset",
          opacity: 1,
        }}
      >
        ⚙
      </Link>
    </main>
  );
}
