import Link from "next/link";
import { lessons } from "@/lib/lesson";
import PlayLessonClient from "../../../PlayLessonClient";

export const dynamicParams = false;
export function generateStaticParams() {
  return lessons.flatMap((lesson) =>
    (lesson.progressionGroups ?? []).flatMap((group) =>
      (group.reviewStep ? [...group.lessons, group.reviewStep] : group.lessons)
        .map((step) => ({ lessonId: lesson.id, stepId: step.id }))
    )
  );
}

export default async function PlayLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string; stepId: string }>;
}) {
  const { lessonId, stepId } = await params;
  const lesson = lessons.find((entry) => entry.id === lessonId);
  const step = lesson?.progressionGroups
    ?.flatMap((group) => (group.reviewStep ? [...group.lessons, group.reviewStep] : group.lessons))
    .find((entry) => entry.id === stepId);

  if (!lesson || !step) {
    return (
      <main
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: 24,
          color: "var(--text-color)",
        }}
      >
        <h1 style={{ fontSize: 40, marginBottom: 8 }}>Lesson step not found</h1>
        <p style={{ opacity: 0.85 }}>The lesson step you asked for does not exist yet.</p>
        <p style={{ marginTop: 14 }}>
          <Link
            href={`/learn/${lessonId}`}
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
            {"←"} Back to unit
          </Link>
        </p>
      </main>
    );
  }

  return <PlayLessonClient lesson={lesson} step={step} />;
}
