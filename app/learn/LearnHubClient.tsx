"use client";

import Link from "@/lib/AppLink";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { lessonSections, lessons } from "@/lib/lesson";
import { readCompletedSteps } from "./progress";

type ContinueTarget = {
  href: string;
  unitId: string;
};

type UnitStatus = {
  lessonId: string;
  totalPlayableSteps: number;
  completedPlayableSteps: number;
  nextStepId: string | null;
};

const visibleSection = lessonSections.find((section) => section.id === "section-1") ?? lessonSections[0];

const bannerPalette = [
  { top: "#3d577b", bottom: "#2b4160" },
  { top: "#556d8a", bottom: "#415772" },
  { top: "#6f8094", bottom: "#546577" },
  { top: "#435e80", bottom: "#314965" },
  { top: "#70849c", bottom: "#556980" },
  { top: "#7d7386", bottom: "#635a6c" },
  { top: "#5a708b", bottom: "#455872" },
  { top: "#8b7a69", bottom: "#6f6153" },
  { top: "#8b6d6a", bottom: "#705554" },
];

const LEARN_THEME = {
  bgTop: "var(--lesson-bg-top)",
  bgBottom: "var(--lesson-bg-bottom)",
  textPrimary: "var(--text-color)",
  activeRing: "var(--path-active-ring, #5e7594)",
  activeIslandTop: "var(--path-bubble-active-top, #425b7d)",
  activeIslandBottom: "var(--path-bubble-active-bottom, #2b4160)",
  popupTop: "var(--path-popup-top, #425b7d)",
  popupBottom: "var(--path-popup-bottom, #2b4160)",
  popupButtonTop: "var(--path-popup-button-top, #ebe6da)",
  popupButtonBottom: "var(--path-popup-button-bottom, #ddd6c6)",
  popupButtonText: "var(--path-popup-button-text, #2b4160)",
};

function getPlayableSteps(lessonId: string) {
  const lesson = lessons.find((entry) => entry.id === lessonId);
  return (
    lesson?.progressionGroups
      ?.flatMap((group) => group.lessons)
      .filter((step) => Boolean(step.exerciseSet)) ?? []
  );
}

function getContinueTarget(unitStatuses: UnitStatus[]): ContinueTarget | null {
  for (const status of unitStatuses) {
    if (status.nextStepId) {
      return {
        href: `/learn/${status.lessonId}/play/${status.nextStepId}`,
        unitId: status.lessonId,
      };
    }
  }

  const firstPlayableLesson = lessons.find((lesson) => getPlayableSteps(lesson.id).length > 0);
  if (!firstPlayableLesson) {
    return null;
  }

  return {
    href: `/learn/${firstPlayableLesson.id}`,
    unitId: firstPlayableLesson.id,
  };
}

function LessonStarIcon({ dimmed = false }: { dimmed?: boolean }) {
  return (
    <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M32 8l7.2 14.6 16.1 2.3-11.7 11.4 2.8 16-14.4-7.5-14.4 7.5 2.8-16L8.7 24.9l16.1-2.3z"
        fill={dimmed ? "rgba(140, 155, 173, 0.34)" : "#f8fbff"}
      />
    </svg>
  );
}

function SegmentedRing({
  completedCount,
  totalSegments,
  active,
  pulsing = false,
}: {
  completedCount: number;
  totalSegments: number;
  active: boolean;
  pulsing?: boolean;
}) {
  const size = 112;
  const radius = 44;
  const strokeWidth = 7;
  const segmentCount = Math.max(totalSegments, 1);
  const angleStep = 360 / segmentCount;
  const gapAngle = Math.min(14, angleStep * 0.28);
  const center = size / 2;

  function describeArc(startAngle: number, endAngle: number) {
    const startRadians = (startAngle * Math.PI) / 180;
    const endRadians = (endAngle * Math.PI) / 180;
    const startX = center + radius * Math.cos(startRadians);
    const startY = center + radius * Math.sin(startRadians);
    const endX = center + radius * Math.cos(endRadians);
    const endY = center + radius * Math.sin(endRadians);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${startX.toFixed(3)} ${startY.toFixed(3)} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX.toFixed(3)} ${endY.toFixed(3)}`;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`main-ring-svg ${pulsing ? "is-pulsing" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: segmentCount }, (_, index) => {
        const startAngle = -90 + index * angleStep + gapAngle / 2;
        const endAngle = -90 + (index + 1) * angleStep - gapAngle / 2;
        const stroke =
          index < completedCount
            ? active
              ? LEARN_THEME.activeRing
              : "rgba(122, 139, 159, 0.34)"
            : "rgba(71, 91, 117, 0.38)";

        return (
          <path
            key={index}
            d={describeArc(startAngle, endAngle)}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function MainIsland({
  href,
  active,
  showProgress,
  completedCount,
  totalSegments,
  selected,
  onToggle,
  title,
  actionLabel,
}: {
  href: string;
  active: boolean;
  showProgress: boolean;
  completedCount: number;
  totalSegments: number;
  selected: boolean;
  onToggle: () => void;
  title: string;
  actionLabel: string;
}) {
  const router = useRouter();

  return (
    <div
      className={`main-island-wrap ${showProgress ? "has-progress" : ""} ${active ? "is-active" : ""} ${selected ? "is-selected" : ""}`}
    >
      {showProgress ? (
        <SegmentedRing
          completedCount={completedCount}
          totalSegments={totalSegments}
          active={active}
          pulsing={active}
        />
      ) : null}
      <button type="button" className={`main-island ${active ? "is-active" : ""}`} onClick={onToggle}>
        <span className="main-island-icon">
          <LessonStarIcon dimmed={!active} />
        </span>
      </button>
      {selected ? (
        <div className="island-popup">
          <div className="island-popup-title">{title}</div>
          <button
            type="button"
            className="island-popup-button"
            onClick={() => {
              router.push(href);
            }}
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PathIsland({
  href,
  selected,
  onToggle,
  title,
}: {
  href: string;
  selected: boolean;
  onToggle: () => void;
  title: string;
}) {
  const router = useRouter();

  return (
    <div className={`main-island-wrap is-secondary ${selected ? "is-selected" : ""}`}>
      <button type="button" className="main-island is-secondary" onClick={onToggle}>
        <span className="main-island-icon">
          <LessonStarIcon dimmed />
        </span>
      </button>
      {selected ? (
        <div className="island-popup">
          <div className="island-popup-title">{title}</div>
          <button
            type="button"
            className="island-popup-button"
            onClick={() => {
              router.push(href);
            }}
          >
            Open unit
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function LearnHubClient() {
  const [completedByLessonId, setCompletedByLessonId] = useState<Record<string, string[]>>({});
  const [selectedIslandKey, setSelectedIslandKey] = useState<string | null>(null);
  const [hasPrimedSelection, setHasPrimedSelection] = useState(false);

  useEffect(() => {
    const next: Record<string, string[]> = {};
    for (const lesson of lessons) {
      next[lesson.id] = (readCompletedSteps(lesson.id) ?? []);
    }
    setCompletedByLessonId(next);
  }, []);

  const unitStatuses = useMemo<UnitStatus[]>(
    () =>
      lessons.map((lesson) => {
        const completed = new Set(completedByLessonId[lesson.id] ?? []);
        const playableSteps = getPlayableSteps(lesson.id);
        const nextStep = playableSteps.find((step) => !completed.has(step.id)) ?? null;
        const completedPlayableSteps = playableSteps.filter((step) => completed.has(step.id)).length;

        return {
          lessonId: lesson.id,
          totalPlayableSteps: playableSteps.length,
          completedPlayableSteps,
          nextStepId: nextStep?.id ?? null,
        };
      }),
    [completedByLessonId]
  );

  const continueTarget = useMemo(() => getContinueTarget(unitStatuses), [unitStatuses]);

  useEffect(() => {
    if (hasPrimedSelection || !continueTarget?.unitId) {
      return;
    }

    setSelectedIslandKey(`${continueTarget.unitId}-main`);
    setHasPrimedSelection(true);
  }, [continueTarget, hasPrimedSelection]);

  function toggleIsland(key: string) {
    setSelectedIslandKey((current) => (current === key ? null : key));
  }

  return (
    <div className="learn-map-page">
      <div className="learn-map-list">
        {visibleSection.lessons.map((lesson, index) => {
          const palette = bannerPalette[index % bannerPalette.length];
          const status = unitStatuses.find((entry) => entry.lessonId === lesson.id);
          const title = lesson.title.replace(/^Unit \d+: /, "");
          const active = continueTarget?.unitId === lesson.id;
          const href =
            active && status?.nextStepId
              ? continueTarget.href
              : status?.nextStepId
                ? `/learn/${lesson.id}/play/${status.nextStepId}`
                : `/learn/${lesson.id}`;
          const completedCount = status?.completedPlayableSteps ?? 0;
          const totalSegments = Math.max(status?.totalPlayableSteps ?? 0, 5);

          return (
            <section key={lesson.id} className="map-unit-section">
              <div
                className="map-banner"
                style={
                  {
                    "--banner-top": palette.top,
                    "--banner-bottom": palette.bottom,
                  } as React.CSSProperties
                }
              >
                <Link href={`/learn/${lesson.id}`} className="map-banner-link">
                  <div className="map-banner-kicker">
                    {lesson.sectionTitle.toUpperCase()}, UNIT {lesson.unitNumber}
                  </div>
                  <h2 className="map-banner-title">{title}</h2>
                </Link>
              </div>

              <div className="map-lesson-path">
                <div className="path-center">
                  <MainIsland
                    href={href}
                    active={active}
                    showProgress={active}
                    completedCount={Math.min(completedCount, totalSegments)}
                    totalSegments={totalSegments}
                    selected={selectedIslandKey === `${lesson.id}-main`}
                    onToggle={() => toggleIsland(`${lesson.id}-main`)}
                    title={title}
                    actionLabel={active ? "Continue lessons" : "Open unit"}
                  />
                </div>

                <div className="path-row left">
                  <PathIsland
                    href={`/learn/${lesson.id}`}
                    selected={selectedIslandKey === `${lesson.id}-left-1`}
                    onToggle={() => toggleIsland(`${lesson.id}-left-1`)}
                    title={title}
                  />
                </div>
                <div className="path-row right">
                  <PathIsland
                    href={`/learn/${lesson.id}`}
                    selected={selectedIslandKey === `${lesson.id}-right-1`}
                    onToggle={() => toggleIsland(`${lesson.id}-right-1`)}
                    title={title}
                  />
                </div>
                <div className="path-row left">
                  <PathIsland
                    href={`/learn/${lesson.id}`}
                    selected={selectedIslandKey === `${lesson.id}-left-2`}
                    onToggle={() => toggleIsland(`${lesson.id}-left-2`)}
                    title={title}
                  />
                </div>
                <div className="path-row right">
                  <PathIsland
                    href={`/learn/${lesson.id}`}
                    selected={selectedIslandKey === `${lesson.id}-right-2`}
                    onToggle={() => toggleIsland(`${lesson.id}-right-2`)}
                    title={title}
                  />
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <style jsx global>{`
        .learn-map-page {
          min-height: var(--page-content-height);
          margin: 0 -24px -24px;
          padding: 0 16px 48px;
          background: linear-gradient(180deg, ${LEARN_THEME.bgTop} 0%, ${LEARN_THEME.bgBottom} 100%);
          color: ${LEARN_THEME.textPrimary};
        }

        .learn-map-page .learn-map-list {
          display: grid;
          gap: 26px;
          max-width: 440px;
          margin: 0 auto;
          padding-top: 10px;
        }

        .learn-map-page .map-unit-section {
          position: relative;
        }

        .learn-map-page .map-banner {
          position: relative;
          border-radius: 26px;
          background: linear-gradient(180deg, var(--banner-top) 0%, var(--banner-bottom) 100%);
          box-shadow: inset 0 -6px 0 rgba(25, 39, 58, 0.24);
          padding: 18px 20px;
        }

        .learn-map-page .map-banner-link {
          display: block;
          text-decoration: none;
          color: #f1ebde;
        }

        .learn-map-page .map-banner-kicker {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          opacity: 0.88;
        }

        .learn-map-page .map-banner-title {
          margin: 6px 0 0;
          font-size: clamp(28px, 7vw, 46px);
          line-height: 1.04;
          font-weight: 800;
        }

        .learn-map-page .map-lesson-path {
          position: relative;
          min-height: 520px;
          padding-top: 46px;
        }

        .learn-map-page .map-lesson-path::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 118px;
          bottom: 56px;
          width: 8px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(49, 68, 92, 0.9) 0%, rgba(31, 46, 66, 0.5) 100%);
          opacity: 0.45;
        }

        .learn-map-page .path-center {
          display: flex;
          justify-content: center;
          margin-bottom: 10px;
          position: relative;
          z-index: 1;
        }

        .learn-map-page .main-island-wrap {
          position: relative;
          width: 112px;
          height: 112px;
          margin-top: 18px;
          display: grid;
          place-items: center;
        }

        .learn-map-page .main-island-wrap::before {
          content: none;
        }

        .learn-map-page .main-island-wrap.has-progress::before {
          content: "";
          position: absolute;
          inset: 7px;
          border-radius: 999px;
          border: 6px solid rgba(94, 117, 148, 0.18);
          z-index: 0;
          pointer-events: none;
        }

        .learn-map-page .main-island-wrap.has-progress::after {
          content: "";
          position: absolute;
          inset: -8px;
          border-radius: 999px;
          background: radial-gradient(
            circle,
            rgba(94, 117, 148, 0.3) 0%,
            rgba(94, 117, 148, 0.18) 42%,
            rgba(94, 117, 148, 0) 74%
          );
          z-index: 0;
          pointer-events: none;
          animation: active-ring-halo 1.6s ease-in-out infinite;
        }

        .learn-map-page .main-ring-svg {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          transform-origin: center;
        }

        .learn-map-page .main-ring-svg.is-pulsing {
          filter: drop-shadow(0 0 10px rgba(94, 117, 148, 0.34));
          animation: active-ring-pulse 1.6s ease-in-out infinite;
        }

        .learn-map-page .main-island {
          position: absolute;
          inset: 18px;
          z-index: 2;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          border: 0;
          background: linear-gradient(180deg, #627082 0%, #425061 100%);
          box-shadow: inset 0 -7px 0 rgba(30, 39, 51, 0.32);
          cursor: pointer;
        }

        .learn-map-page .main-island.is-active {
          background: linear-gradient(180deg, ${LEARN_THEME.activeIslandTop} 0%, ${LEARN_THEME.activeIslandBottom} 100%);
          box-shadow: inset 0 -7px 0 rgba(24, 38, 57, 0.34);
        }

        .learn-map-page .main-island-wrap:not(.is-secondary) .main-island.is-active {
          box-shadow:
            inset 0 -7px 0 rgba(24, 38, 57, 0.34),
            0 10px 28px rgba(66, 91, 125, 0.14);
        }

        .learn-map-page .main-island.is-secondary {
          background: linear-gradient(180deg, rgba(95, 110, 128, 0.94) 0%, rgba(65, 79, 96, 0.98) 100%);
          box-shadow:
            inset 0 -7px 0 rgba(24, 33, 45, 0.34),
            0 0 0 5px rgba(186, 188, 183, 0.88);
        }

        .learn-map-page .main-island-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
        }

        .learn-map-page .main-island-wrap.is-secondary {
          width: 112px;
          height: 112px;
        }

        .learn-map-page .main-island-wrap.is-selected {
          z-index: 12;
        }

        .learn-map-page .island-popup {
          position: absolute;
          left: 50%;
          top: calc(100% + 14px);
          transform: translateX(-50%);
          min-width: 248px;
          padding: 18px 18px 16px;
          border-radius: 24px;
          background: linear-gradient(180deg, ${LEARN_THEME.popupTop} 0%, ${LEARN_THEME.popupBottom} 100%);
          box-shadow: inset 0 -6px 0 rgba(24, 38, 57, 0.34);
          animation: island-pop-in 180ms ease-out;
          z-index: 14;
        }

        .learn-map-page .island-popup::before {
          content: "";
          position: absolute;
          left: 50%;
          top: -10px;
          width: 18px;
          height: 18px;
          background: ${LEARN_THEME.popupTop};
          transform: translateX(-50%) rotate(45deg);
          border-radius: 4px;
        }

        .learn-map-page .island-popup-title {
          color: #f1ebde;
          font-size: 16px;
          font-weight: 800;
          line-height: 1.2;
        }

        .learn-map-page .island-popup-button {
          margin-top: 14px;
          width: 100%;
          padding: 14px 16px;
          border: 0;
          border-radius: 18px;
          background: linear-gradient(180deg, ${LEARN_THEME.popupButtonTop} 0%, ${LEARN_THEME.popupButtonBottom} 100%);
          color: ${LEARN_THEME.popupButtonText};
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          box-shadow: 0 6px 0 rgba(181, 172, 154, 0.92);
          cursor: pointer;
          transition: transform 120ms ease, box-shadow 120ms ease;
        }

        .learn-map-page .island-popup-button:active {
          transform: translateY(4px);
          box-shadow: 0 2px 0 rgba(181, 172, 154, 0.92);
        }

        .learn-map-page .path-row {
          display: flex;
          margin-top: 18px;
          position: relative;
          z-index: 1;
        }

        .learn-map-page .path-row.left {
          justify-content: flex-start;
          padding-left: 34px;
        }

        .learn-map-page .path-row.right {
          justify-content: flex-end;
          padding-right: 34px;
        }

        @keyframes island-pop-in {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-8px) scale(0.94);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        @keyframes active-ring-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.78;
            transform: scale(1.09);
          }
        }

        @keyframes active-ring-halo {
          0%,
          100% {
            opacity: 0.34;
            transform: scale(0.94);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.14);
          }
        }

        @media (max-width: 640px) {
          .learn-map-page {
            margin: 0 -16px -16px;
            padding: 0 16px 40px;
          }

          .learn-map-page .map-banner-title {
            font-size: clamp(24px, 8vw, 36px);
          }

          .learn-map-page .map-lesson-path {
            min-height: 500px;
          }

          .learn-map-page .path-row.left {
            padding-left: 14px;
          }

          .learn-map-page .path-row.right {
            padding-right: 14px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .learn-map-page .main-ring-svg.is-pulsing,
          .learn-map-page .main-island-wrap.has-progress::after,
          .learn-map-page .island-popup {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
