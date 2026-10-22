"use client";

// The same component already renders /learn. Its layout effect restores local
// progress before client paint; a second client-only chunk adds no protection.
import UnitProgressClient from './UnitProgressClient';

export default function UnitMapClient({ focusLessonId }: { focusLessonId: string }) {
  return <UnitProgressClient focusLessonId={focusLessonId} />;
}
