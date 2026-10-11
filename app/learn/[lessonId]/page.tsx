import Link from "next/link";
import { lessons } from "@/lib/lesson";
import UnitProgressClient from "./UnitProgressClient";

export const dynamicParams = false;
export function generateStaticParams() {
  return lessons.map((lesson) => ({ lessonId: lesson.id }));
}

export default async function UnitPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;

  const lesson = lessons.find((entry) => entry.id === lessonId);

  if (!lesson) {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: 24,
          color: "var(--text-color)",
        }}
      >
        <h1 style={{ fontSize: 40, marginBottom: 8 }}>Unit not found</h1>
        <p style={{ opacity: 0.85 }}>Tried id: <code>{lessonId}</code></p>
        <p style={{ marginTop: 14 }}>
          <Link
            href="/learn"
            style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--border-color)",
              color: "var(--text-color)",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            {"←"} Back
          </Link>
        </p>
      </main>
    );
  }

  return <UnitProgressClient focusLessonId={lesson.id} />;
}
