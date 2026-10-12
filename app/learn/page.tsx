import UnitProgressClient from "./[lessonId]/UnitProgressClient";
import Link from "@/lib/AppLink";

export default function LearnIndexPage() {
  return <>
    <div className="flex flex-wrap gap-3 bg-[var(--bg-color)] px-5 py-4 text-[var(--text-color)]">
      <Link href="/read/" className="rounded-xl border border-[var(--border-color)] px-4 py-2">Read Coptic →</Link>
      <Link href="/vocabulary/" className="rounded-xl border border-[var(--border-color)] px-4 py-2">Vocabulary & review →</Link>
    </div>
    <UnitProgressClient />
  </>;
}
