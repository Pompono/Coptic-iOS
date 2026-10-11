"use client";

import dynamic from 'next/dynamic';

// The interactive map restores local progress and measures its SVG/popups on
// the device. Do not hydrate an exported snapshot of a different progress state.
const UnitProgressClient = dynamic(() => import('./UnitProgressClient'), {
  ssr: false,
  loading: () => <main style={{ padding: 24 }}>Loading your progress…</main>,
});

export default function UnitMapClient({ focusLessonId }: { focusLessonId: string }) {
  return <UnitProgressClient focusLessonId={focusLessonId} />;
}
