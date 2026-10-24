"use client";

import dynamic from 'next/dynamic';
import type { Lesson, UnitLessonStep } from '@/lib/lesson';
import PageHeader, { PageBackLink } from '@/app/PageHeader';
import DelayedStatus from '@/app/DelayedStatus';

// Exercises randomize their answer order. Initialize them only on the device,
// so the exported HTML cannot disagree with the first client render.
const LessonClient = dynamic(() => import('./[lessonId]/LessonClient'), {
  ssr: false,
  loading: () => <main className="app-page"><PageBackLink href="/learn/">Learning path</PageBackLink><PageHeader title="Practice" icon="learn"/><DelayedStatus>Preparing this exercise…</DelayedStatus></main>,
});

export default function PlayLessonClient({ lesson, step }: { lesson: Lesson; step: UnitLessonStep }) {
  return <LessonClient lesson={lesson} step={step} />;
}
