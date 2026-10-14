"use client";
import UnitMastery from "../learning/UnitMastery";

import Link from "@/lib/AppLink";
import { type CSSProperties, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { lessonSections, lessons, type Lesson, type UnitLessonStep, type UnitProgressGroup } from "@/lib/lesson";
import { readCompletedSteps, readFailedSteps } from "../progress";

type GroupSelection = {
  group: UnitProgressGroup;
  step: UnitLessonStep;
  unlocked: boolean;
  completedCount: number;
  currentLessonNumber: number;
  isCurrentLessonCompleted: boolean;
  hasCurrentLessonFailed: boolean;
};

const UNIT_SURFACE = {
  bgTop: "var(--lesson-bg-top)",
  bgBottom: "var(--lesson-bg-bottom)",
  textPrimary: "var(--text-color)",
  textSecondary: "var(--text-muted)",
  textSoft: "var(--text-soft)",
};

type UnitPathTheme = {
  bannerTop: string;
  bannerBottom: string;
  activeRing: string;
  activeRingRgb: string;
  inactiveRing: string;
  bubbleActiveTop: string;
  bubbleActiveBottom: string;
  bubbleCompleteTop: string;
  bubbleCompleteBottom: string;
  popupTop: string;
  popupBottom: string;
  popupText: string;
  popupButtonTop: string;
  popupButtonBottom: string;
  popupButtonText: string;
};

const DEFAULT_UNIT_PATH_THEME: UnitPathTheme = {
  bannerTop: "#425b7d",
  bannerBottom: "#2b4160",
  activeRing: "#5e7594",
  activeRingRgb: "94, 117, 148",
  inactiveRing: "rgba(93, 109, 128, 0.34)",
  bubbleActiveTop: "#425b7d",
  bubbleActiveBottom: "#2b4160",
  bubbleCompleteTop: "#6f8198",
  bubbleCompleteBottom: "#53667d",
  popupTop: "#425b7d",
  popupBottom: "#2b4160",
  popupText: "#f1ebde",
  popupButtonTop: "#ebe6da",
  popupButtonBottom: "#ddd6c6",
  popupButtonText: "#2b4160",
};

const SECTION_1_UNIT_2_PATH_THEME: UnitPathTheme = {
  bannerTop: "#d886fb",
  bannerBottom: "#bb68eb",
  activeRing: "#cb88f7",
  activeRingRgb: "203, 136, 247",
  inactiveRing: "rgba(157, 111, 191, 0.32)",
  bubbleActiveTop: "#dc92ff",
  bubbleActiveBottom: "#b861e7",
  bubbleCompleteTop: "#c785ef",
  bubbleCompleteBottom: "#9b5fca",
  popupTop: "#b96fe6",
  popupBottom: "#9458cc",
  popupText: "#fff8ff",
  popupButtonTop: "#f7e7ff",
  popupButtonBottom: "#eccfff",
  popupButtonText: "#7444a8",
};

function getUnitPathTheme(lesson: Pick<Lesson, "sectionId" | "unitNumber"> | null | undefined): UnitPathTheme {
  if (lesson?.sectionId === "section-1" && lesson.unitNumber === 2) {
    return SECTION_1_UNIT_2_PATH_THEME;
  }

  return DEFAULT_UNIT_PATH_THEME;
}

function getUnitThemeVars(theme: UnitPathTheme): CSSProperties {
  const palette = theme === SECTION_1_UNIT_2_PATH_THEME ? "path-purple" : "path";
  return {
    ["--unit-banner-top" as string]: `var(--${palette}-banner-top, ${theme.bannerTop})`,
    ["--unit-banner-bottom" as string]: `var(--${palette}-banner-bottom, ${theme.bannerBottom})`,
    ["--unit-active-ring" as string]: `var(--${palette}-active-ring, ${theme.activeRing})`,
    ["--unit-active-ring-rgb" as string]: `var(--${palette}-active-ring-rgb, ${theme.activeRingRgb})`,
    ["--unit-inactive-ring" as string]: `var(--${palette}-inactive-ring, ${theme.inactiveRing})`,
    ["--unit-bubble-active-top" as string]: `var(--${palette}-bubble-active-top, ${theme.bubbleActiveTop})`,
    ["--unit-bubble-active-bottom" as string]: `var(--${palette}-bubble-active-bottom, ${theme.bubbleActiveBottom})`,
    ["--unit-bubble-complete-top" as string]: `var(--${palette}-bubble-complete-top, ${theme.bubbleCompleteTop})`,
    ["--unit-bubble-complete-bottom" as string]: `var(--${palette}-bubble-complete-bottom, ${theme.bubbleCompleteBottom})`,
    ["--unit-popup-top" as string]: `var(--${palette}-popup-top, ${theme.popupTop})`,
    ["--unit-popup-bottom" as string]: `var(--${palette}-popup-bottom, ${theme.popupBottom})`,
    ["--unit-popup-text" as string]: `var(--${palette}-popup-text, ${theme.popupText})`,
    ["--unit-popup-button-top" as string]: `var(--${palette}-popup-button-top, ${theme.popupButtonTop})`,
    ["--unit-popup-button-bottom" as string]: `var(--${palette}-popup-button-bottom, ${theme.popupButtonBottom})`,
    ["--unit-popup-button-text" as string]: `var(--${palette}-popup-button-text, ${theme.popupButtonText})`,
  } as CSSProperties;
}

const ISLAND_OUTER_SIZE = 118;
const ISLAND_INNER_SIZE = 86;
const ISLAND_ICON_SIZE = 46;
const ISLAND_RING_RADIUS = 49;
const ISLAND_RING_STROKE = 7;

function getGroupCompletedCount(group: UnitProgressGroup, completedStepIds: Set<string>) {
  return group.lessons.filter((lesson) => completedStepIds.has(lesson.id)).length;
}

function isGroupUnlocked(
  group: UnitProgressGroup,
  completedByGroupId: Map<string, number>,
  groupsById: Map<string, UnitProgressGroup>
) {
  if (!group.unlockAfterGroupId) {
    return true;
  }

  const requiredGroup = groupsById.get(group.unlockAfterGroupId);
  if (!requiredGroup) {
    return true;
  }

  return (completedByGroupId.get(requiredGroup.id) ?? 0) >= requiredGroup.totalLessons;
}

function findCurrentStep(group: UnitProgressGroup, completedStepIds: Set<string>) {
  return group.lessons.find((lesson) => !completedStepIds.has(lesson.id)) ?? group.lessons[group.lessons.length - 1];
}

function findCurrentGroupId(
  groups: UnitProgressGroup[],
  completedByGroupId: Map<string, number>,
  groupsById: Map<string, UnitProgressGroup>
) {
  let fallbackGroupId: string | null = null;

  for (const group of groups) {
    const unlocked = isGroupUnlocked(group, completedByGroupId, groupsById);
    const completedCount = completedByGroupId.get(group.id) ?? 0;

    if (!unlocked || completedCount >= group.totalLessons) {
      continue;
    }

    if (group.kind === "lesson-group") {
      return group.id;
    }

    fallbackGroupId ??= group.id;
  }

  return fallbackGroupId;
}

type UnitRenderState = {
  lesson: Lesson;
  groups: UnitProgressGroup[];
  theme: UnitPathTheme;
  themeVars: CSSProperties;
  completedSet: Set<string>;
  failedSet: Set<string>;
  groupsById: Map<string, UnitProgressGroup>;
  completedByGroupId: Map<string, number>;
  isUnitFullyCompleted: boolean;
  currentGroupId: string | null;
  unitUnlocked: boolean;
};

function getGroupSelectionKey(lessonId: string, groupId: string) {
  return `${lessonId}::${groupId}`;
}

function buildGroupSelection(unitState: UnitRenderState, group: UnitProgressGroup, unlocked: boolean): GroupSelection {
  const completedCount = unitState.completedByGroupId.get(group.id) ?? 0;
  const currentStep = findCurrentStep(group, unitState.completedSet);
  const currentLessonNumber = group.lessons.findIndex((entry) => entry.id === currentStep.id) + 1;

  return {
    group,
    step: currentStep,
    unlocked,
    completedCount,
    currentLessonNumber,
    isCurrentLessonCompleted: unitState.completedSet.has(currentStep.id),
    hasCurrentLessonFailed: unitState.failedSet.has(currentStep.id),
  };
}

function SegmentedRing({
  completedCount,
  totalSegments,
  unlocked,
  hidden = false,
  pulsing = false,
}: {
  completedCount: number;
  totalSegments: number;
  unlocked: boolean;
  hidden?: boolean;
  pulsing?: boolean;
}) {
  if (hidden) {
    return null;
  }

  const size = ISLAND_OUTER_SIZE;
  const radius = ISLAND_RING_RADIUS;
  const strokeWidth = ISLAND_RING_STROKE;
  const segmentCount = Math.max(totalSegments, 1);
  const angleStep = 360 / segmentCount;
  const gapAngle = Math.min(14, angleStep * 0.28);
  const activeStroke = unlocked ? "var(--unit-active-ring)" : "rgba(118, 133, 151, 0.34)";
  const inactiveStroke = "var(--unit-inactive-ring)";
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
      className={`group-segmented-ring ${pulsing ? "is-pulsing" : ""}`}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "visible",
      }}
    >
      {Array.from({ length: segmentCount }, (_, index) => {
        const startAngle = -90 + index * angleStep + gapAngle / 2;
        const endAngle = -90 + (index + 1) * angleStep - gapAngle / 2;
        const stroke = index < completedCount ? activeStroke : inactiveStroke;

        return (
          <path
            key={index}
            d={describeArc(startAngle, endAngle)}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={index < completedCount ? 1 : 0.95}
          />
        );
      })}
    </svg>
  );
}

function LessonCrossIcon({
  unlocked,
  completed,
}: {
  unlocked: boolean;
  completed: boolean;
}) {
  const fill = !unlocked ? "rgba(223, 231, 240, 0.7)" : "#ffffff";
  const filter = !unlocked
    ? "drop-shadow(0 1px 1px rgba(18, 28, 40, 0.24))"
    : completed
      ? "drop-shadow(0 1px 1px rgba(28, 44, 20, 0.22))"
      : "drop-shadow(0 1px 1px rgba(18, 28, 40, 0.18))";

  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: ISLAND_ICON_SIZE,
        height: ISLAND_ICON_SIZE,
        background: fill,
        WebkitMaskImage: 'url("/lesson-group-cross-exact.svg")',
        maskImage: 'url("/lesson-group-cross-exact.svg")',
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        filter,
      }}
    />
  );
}

function ThemedIslandSurface({
  completed,
  theme,
}: {
  completed: boolean;
  theme: UnitPathTheme;
}) {
  const gradientId = useId().replace(/:/g, "");
  const bubblePath =
    "m1099.76 1676.47c-322.27 0-582.76-257.58-582.76-576.24 0-318.65 260.49-576.23 582.76-576.23 322.26 0 582.75 257.58 582.75 576.23 0 318.66-260.49 576.24-582.75 576.24z";

  return (
    <svg
      width={ISLAND_INNER_SIZE}
      height={ISLAND_INNER_SIZE}
      viewBox="517 523 1166 1154"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
    >
      <defs>
        <clipPath id={`${gradientId}-clip`} clipPathUnits="userSpaceOnUse">
          <path d={bubblePath} />
        </clipPath>
        <linearGradient
          id={`${gradientId}-fill`}
          x1="1099.76"
          y1="523"
          x2="1099.76"
          y2="1676.47"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={theme.bubbleActiveTop} />
          <stop offset="100%" stopColor={theme.bubbleActiveBottom} />
        </linearGradient>
      </defs>

      <g clipPath={`url(#${gradientId}-clip)`}>
        <path d={bubblePath} fill={`url(#${gradientId}-fill)`} />

        {completed ? (
          <>
            <path
              d="m443.7 1063.1l479-596.9q19.8-24.7 30.4-35.6 12.5-11.2 34-20.4 21.5-9.2 47 0.7 25.6 10 60 37.5 27.9 22.4 41.8 42.4 14 20 17.6 35.3 3.6 15.3-4.2 33.8-5.8 18.2-14.4 29-6.7 10.5-23.1 30.9l-478.9 596.8q-20.7 25.8-32.3 35.9-10.6 10.9-32.1 20.1-21.5 9.2-47.1-0.7-25.5-9.9-59.9-37.5-27.9-22.4-41.8-42.4-14-20-17.6-35.3-3.6-15.3 2.2-33.5 7.8-18.5 14.4-29 8.6-10.8 25-31.1z"
              fill="#ffffff"
              opacity="0.18"
            />
            <path
              d="m772.2 1400.9l561.6-699.8q23.3-28.9 35.6-41.8 14.7-13 39.9-23.8 25.2-10.8 55.2 0.8 30 11.6 70.2 44 32.8 26.2 49.1 49.7 16.4 23.4 20.6 41.3 4.3 17.9-4.8 39.6-6.9 21.4-17 34-7.8 12.3-27 36.3l-561.6 699.7q-24.2 30.2-37.9 42.1-12.3 12.8-37.6 23.6-25.2 10.8-55.2-0.8-29.9-11.7-70.2-44-32.7-26.3-49.1-49.7-16.3-23.5-20.6-41.4-4.2-17.9 2.6-39.3 9.1-21.7 16.9-34 10.1-12.6 29.3-36.5z"
              fill="#ffffff"
              opacity="0.1"
            />
          </>
        ) : null}
      </g>
    </svg>
  );
}

function GroupIsland({
  group,
  completedCount,
  unlocked,
  showProgress,
  selected,
  alignRight,
  onClick,
  interactive = true,
  theme,
}: {
  group: UnitProgressGroup;
  completedCount: number;
  unlocked: boolean;
  showProgress: boolean;
  selected: boolean;
  alignRight: boolean;
  onClick: () => void;
  interactive?: boolean;
  theme: UnitPathTheme;
}) {
  const isCompleted = completedCount >= group.totalLessons;
  const centerBackground =
    !unlocked
      ? "linear-gradient(180deg, rgba(84, 98, 115, 0.82) 0%, rgba(54, 66, 81, 0.9) 100%)"
      : "transparent";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: alignRight ? "flex-end" : "flex-start",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!interactive}
        aria-hidden={!interactive}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: interactive ? "pointer" : "default",
          transform: selected ? "translateY(-2px)" : "translateY(0)",
          transition: "transform 160ms cubic-bezier(0.22, 1, 0.36, 1)",
          opacity: interactive ? 1 : 0.98,
        }}
      >
        <div
          className={`group-island-shell ${showProgress ? "is-current" : "is-static"}`}
          style={{
            width: ISLAND_OUTER_SIZE,
            height: ISLAND_OUTER_SIZE,
            borderRadius: 999,
            position: "relative",
            boxShadow: selected ? "0 14px 28px rgba(0, 0, 0, 0.28)" : "none",
            transition: "box-shadow 160ms ease",
          }}
        >
          {showProgress ? (
            <SegmentedRing
              completedCount={completedCount}
              totalSegments={group.totalLessons}
              unlocked={unlocked}
              hidden={isCompleted}
              pulsing={unlocked && !isCompleted}
            />
          ) : null}
          <div
            style={{
              width: ISLAND_INNER_SIZE,
              height: ISLAND_INNER_SIZE,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: centerBackground,
              boxShadow: !unlocked
                ? "inset 0 -6px 0 rgba(38, 47, 58, 0.42)"
                : isCompleted
                  ? "inset 0 -7px 0 rgba(61, 77, 97, 0.3)"
                  : "inset 0 -7px 0 rgba(24, 38, 57, 0.34)",
              fontSize: group.kind === "review" ? 34 : 36,
              fontWeight: 900,
              lineHeight: 1,
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              overflow: "hidden",
            }}
          >
            {unlocked ? <ThemedIslandSurface completed={isCompleted} theme={theme} /> : null}
            <LessonCrossIcon unlocked={unlocked} completed={isCompleted} />
          </div>
        </div>
      </button>
    </div>
  );
}

type GroupPopupProps = {
  lessonId: string;
  selection: GroupSelection;
  pressed: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  fallbackHref?: string | null;
  fallbackLabel?: string;
};

function GroupPopup({
  lessonId,
  selection,
  pressed,
  onPressStart,
  onPressEnd,
  fallbackHref = null,
  fallbackLabel = "Start",
}: GroupPopupProps) {
  const {
    group,
    step,
    unlocked,
    currentLessonNumber,
    isCurrentLessonCompleted,
    hasCurrentLessonFailed,
    completedCount,
  } = selection;
  const isCompletedLessonGroup = group.kind === "lesson-group" && completedCount >= group.totalLessons;
  const actionStep = isCompletedLessonGroup && group.reviewStep ? group.reviewStep : step;
  const stepActionHref = unlocked ? `/learn/${lessonId}/play/${actionStep.id}` : null;
  const canPlay =
    Boolean(stepActionHref) && (Boolean(step.exerciseSet) || Boolean(isCompletedLessonGroup && group.reviewStep));
  const buttonLabel = isCompletedLessonGroup
    ? "Review"
    : group.kind === "review" && hasCurrentLessonFailed && !isCurrentLessonCompleted
      ? "Try Again"
      : isCurrentLessonCompleted
        ? "Replay lesson"
        : "Start";
  const actionHref = canPlay ? stepActionHref : unlocked ? fallbackHref : null;
  const actionLabel = canPlay ? buttonLabel : actionHref ? fallbackLabel : unlocked ? "Coming soon" : "Locked";
  const popupRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const [popupLayout, setPopupLayout] = useState({ offsetX: 0, nubLeft: 54 });

  useLayoutEffect(() => {
    function updatePopupLayout() {
      const popup = popupRef.current;
      const anchor = popup?.parentElement;

      if (!popup || !anchor || typeof window === "undefined") {
        return;
      }

      const popupRect = popup.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const viewportInset = 28;
      const anchorCenterX = anchorRect.left + anchorRect.width / 2;
      const idealOffsetX = anchorRect.width / 2 - popupRect.width / 2;
      const idealPopupLeft = anchorRect.left + idealOffsetX;
      const minPopupLeft = viewportInset;
      const maxPopupLeft = Math.max(minPopupLeft, window.innerWidth - viewportInset - popupRect.width);
      const clampedPopupLeft = Math.min(Math.max(idealPopupLeft, minPopupLeft), maxPopupLeft);
      const offsetX = idealOffsetX + (clampedPopupLeft - idealPopupLeft);
      const popupLeftAfterShift = anchorRect.left + offsetX;
      const nubLeft = Math.max(26, Math.min(popupRect.width - 26, anchorCenterX - popupLeftAfterShift));

      setPopupLayout((current) => {
        if (Math.abs(current.offsetX - offsetX) < 0.5 && Math.abs(current.nubLeft - nubLeft) < 0.5) {
          return current;
        }

        return { offsetX, nubLeft };
      });
    }

    updatePopupLayout();
    window.addEventListener("resize", updatePopupLayout);

    return () => {
      window.removeEventListener("resize", updatePopupLayout);
    };
  }, [buttonLabel, group.id, unlocked]);

  useEffect(() => {
    if (typeof window === "undefined" || hasAutoScrolledRef.current) {
      return;
    }

    const popup = popupRef.current;
    if (!popup) {
      return;
    }

    let measureFrame = 0;
    let settleFrame = 0;
    let scrollFrame = 0;
    const timer = window.setTimeout(() => {
      measureFrame = window.requestAnimationFrame(() => {
        settleFrame = window.requestAnimationFrame(() => {
          const rect = popup.getBoundingClientRect();
          const viewportInset = 28;
          let scrollDelta = 0;

          if (rect.bottom > window.innerHeight - viewportInset) {
            scrollDelta = rect.bottom - (window.innerHeight - viewportInset);
          } else if (rect.top < viewportInset) {
            scrollDelta = rect.top - viewportInset;
          }

          if (Math.abs(scrollDelta) > 1) {
            const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            const targetY = Math.max(0, Math.min(maxScrollY, window.scrollY + scrollDelta));
            scrollFrame = animateWindowScrollTo(targetY);
          }

          hasAutoScrolledRef.current = true;
        });
      });
    }, 70);

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(measureFrame);
      window.cancelAnimationFrame(settleFrame);
      if (scrollFrame) {
        window.cancelAnimationFrame(scrollFrame);
      }
    };
  }, [group.id, popupLayout.offsetX, popupLayout.nubLeft]);

  return (
    <div
      ref={popupRef}
      className={`group-popup ${unlocked ? "is-unlocked" : "is-locked"}`}
      style={{ left: `${popupLayout.offsetX}px` }}
    >
      <div className="group-popup-nub" style={{ left: `${popupLayout.nubLeft}px` }} />
      <div className="group-popup-title">{group.title}</div>
      <div className="group-popup-copy">
        {group.kind === "review" ? group.subtitle : `Lesson ${currentLessonNumber} of ${group.totalLessons}`}
      </div>

      {actionHref ? (
        <Link
          href={actionHref}
          className={`start-link ${pressed ? "is-pressed" : ""}`}
          onMouseDown={onPressStart}
          onMouseUp={onPressEnd}
          onMouseLeave={onPressEnd}
          onTouchStart={onPressStart}
          onTouchEnd={onPressEnd}
          onTouchCancel={onPressEnd}
        >
          <span className="start-link-base" />
          <span className="start-link-face">{actionLabel}</span>
        </Link>
      ) : (
        <button type="button" className="start-link locked" disabled>
          <span className="start-link-base" />
          <span className="start-link-face">{actionLabel}</span>
        </button>
      )}
    </div>
  );
}

function JumpHereButton() {
  return (
    <div className="jump-here-wrap">
      <div className="jump-here-bubble">
        <span>Jump here?</span>
      </div>

      <button
        type="button"
        className="jump-here-link"
        aria-label="Jump here placeholder"
        aria-disabled="true"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <span className="jump-here-link-base" />
        <span className="jump-here-link-face">
          <span className="jump-here-icon" aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}

function getIslandOffset(index: number) {
  const pattern = [
    { marginLeft: 28, marginRight: 0 },
    { marginLeft: 0, marginRight: 30 },
    { marginLeft: 62, marginRight: 0 },
    { marginLeft: 0, marginRight: 54 },
  ];

  return pattern[index % pattern.length];
}

function animateWindowScrollTo(targetY: number) {
  if (typeof window === "undefined") {
    return 0;
  }

  const startY = window.scrollY;
  const distance = targetY - startY;

  if (Math.abs(distance) < 1) {
    return 0;
  }

  const durationMs = Math.min(920, Math.max(560, Math.abs(distance) * 2.6));
  let startedAt: number | null = null;
  let frameId = 0;

  const step = (timestamp: number) => {
    if (startedAt === null) {
      startedAt = timestamp;
    }

    const elapsed = timestamp - startedAt;
    const progress = Math.min(elapsed / durationMs, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    window.scrollTo(0, startY + distance * eased);

    if (progress < 1) {
      frameId = window.requestAnimationFrame(step);
    }
  };

  frameId = window.requestAnimationFrame(step);
  return frameId;
}

export default function UnitProgressClient({ focusLessonId = null }: { focusLessonId?: string | null }) {
  const [completedStepIdsByLessonId, setCompletedStepIdsByLessonId] = useState<Record<string, string[]>>({});
  const [failedStepIdsByLessonId, setFailedStepIdsByLessonId] = useState<Record<string, string[]>>({});
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [pressedStartGroupKey, setPressedStartGroupKey] = useState<string | null>(null);
  const [hasLoadedProgress, setHasLoadedProgress] = useState(false);
  const unitSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const lastAutoScrolledLessonIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nextCompletedStepIdsByLessonId = Object.fromEntries(
      lessons.map((entry) => [entry.id, readCompletedSteps(entry.id)])
    ) as Record<string, string[]>;
    const nextFailedStepIdsByLessonId = Object.fromEntries(
      lessons.map((entry) => [entry.id, readFailedSteps(entry.id)])
    ) as Record<string, string[]>;

    setCompletedStepIdsByLessonId(nextCompletedStepIdsByLessonId);
    setFailedStepIdsByLessonId(nextFailedStepIdsByLessonId);
    setHasLoadedProgress(true);
  }, [focusLessonId]);

  const requestedLesson = useMemo(
    () => (focusLessonId ? lessons.find((entry) => entry.id === focusLessonId) ?? null : null),
    [focusLessonId]
  );

  const lessonStatesById = useMemo(() => {
    let previousUnitsCompleted = true;
    const states = new Map<string, UnitRenderState>();

    for (const entry of lessons) {
      const groups = entry.progressionGroups ?? [];
      const completedSet = new Set(completedStepIdsByLessonId[entry.id] ?? []);
      const failedSet = new Set(failedStepIdsByLessonId[entry.id] ?? []);
      const groupsById = new Map(groups.map((group) => [group.id, group]));
      const completedByGroupId = new Map(groups.map((group) => [group.id, getGroupCompletedCount(group, completedSet)]));
      const isUnitFullyCompleted = groups.every(
        (group) => (completedByGroupId.get(group.id) ?? 0) >= group.totalLessons
      );
      const unitUnlocked = previousUnitsCompleted;

      states.set(entry.id, {
        lesson: entry,
        groups,
        theme: getUnitPathTheme(entry),
        themeVars: getUnitThemeVars(getUnitPathTheme(entry)),
        completedSet,
        failedSet,
        groupsById,
        completedByGroupId,
        isUnitFullyCompleted,
        currentGroupId: unitUnlocked ? findCurrentGroupId(groups, completedByGroupId, groupsById) : null,
        unitUnlocked,
      });

      previousUnitsCompleted = previousUnitsCompleted && isUnitFullyCompleted;
    }

    return states;
  }, [completedStepIdsByLessonId, failedStepIdsByLessonId]);

  const fallbackLessonId = useMemo(() => {
    for (const entry of lessons) {
      const state = lessonStatesById.get(entry.id);
      if (state && !state.isUnitFullyCompleted) {
        return entry.id;
      }
    }

    return lessons[lessons.length - 1]?.id ?? null;
  }, [lessonStatesById]);

  const targetLesson = useMemo(() => {
    if (requestedLesson) {
      return requestedLesson;
    }

    if (!hasLoadedProgress) {
      return lessons[0] ?? null;
    }

    return lessons.find((entry) => entry.id === fallbackLessonId) ?? lessons[0] ?? null;
  }, [requestedLesson, hasLoadedProgress, fallbackLessonId]);

  const visibleLessons = useMemo(() => {
    if (!targetLesson) {
      return lessons;
    }

    return lessonSections.find((section) => section.id === targetLesson.sectionId)?.lessons ?? lessons;
  }, [targetLesson]);

  const visibleLessonStates = useMemo(
    () => visibleLessons.map((entry) => lessonStatesById.get(entry.id)).filter((state): state is UnitRenderState => Boolean(state)),
    [visibleLessons, lessonStatesById]
  );

  useLayoutEffect(() => {
    // Paint the pathway from the top before any optional progress scroll.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [focusLessonId]);

  useEffect(() => {
    if (!hasLoadedProgress || !targetLesson || lastAutoScrolledLessonIdRef.current === targetLesson.id) return;
    const targetNode = unitSectionRefs.current[targetLesson.id];
    if (!targetNode) return;
    lastAutoScrolledLessonIdRef.current = targetLesson.id;
    let frame = 0;
    let cancelled = false;
    const cancel = () => { cancelled = true; window.cancelAnimationFrame(frame); };
    // Two frames let the top of the page paint before moving to an off-screen unit.
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        const shell = document.querySelector(".mobile-chin-page-shell");
        const topInset = 24 + (shell ? parseFloat(getComputedStyle(shell).paddingTop) || 0 : 0);
        const dock = document.querySelector(".mobile-chin-dock");
        const bottomInset = dock ? dock.getBoundingClientRect().height : 0;
        const banner = targetNode.querySelector(".unit-banner") ?? targetNode;
        const bounds = banner.getBoundingClientRect();
        if (bounds.top >= topInset && bounds.bottom <= window.innerHeight - bottomInset) return;
        const start = window.scrollY;
        // The banner fades upward on entry; measure its stable section, not its animated transform.
        const target = Math.max(0, targetNode.getBoundingClientRect().top + start - topInset);
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          window.scrollTo({ top: target, behavior: "instant" }); return;
        }
        let began: number | null = null;
        const step = (timestamp: number) => {
          if (cancelled) return;
          began ??= timestamp;
          const progress = Math.min((timestamp - began) / 360, 1);
          window.scrollTo({ top: start + (target - start) * (1 - Math.pow(1 - progress, 3)), behavior: "instant" });
          if (progress < 1) frame = window.requestAnimationFrame(step);
        };
        frame = window.requestAnimationFrame(step);
      });
    });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("wheel", cancel, { passive: true });
    return () => {
      cancel();
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("wheel", cancel);
    };
  }, [hasLoadedProgress, targetLesson]);

  return (
    <main
      className="unit-map-page"
      onClick={() => {
        setSelectedGroupKey(null);
        setPressedStartGroupKey(null);
      }}
    >
      <div className="unit-map-shell course-map-shell">
        {visibleLessonStates.map((unitState, lessonIndex) => {
          const isFocusedUnit = unitState.lesson.id === targetLesson?.id;
          const TitleTag = isFocusedUnit ? "h1" : "h2";

          return (
            <section
              key={unitState.lesson.id}
              ref={(node) => {
                unitSectionRefs.current[unitState.lesson.id] = node;
              }}
              className={`course-unit-block ${isFocusedUnit ? "is-focused" : ""} ${unitState.unitUnlocked ? "" : "is-locked"}`}
              style={unitState.themeVars}
            >
              <div
                className={`unit-banner ${unitState.unitUnlocked ? "" : "is-locked"}`}
                aria-disabled={!unitState.unitUnlocked}
              >
                <div className="unit-banner-kicker">
                  {unitState.lesson.sectionTitle.toUpperCase()}, UNIT {unitState.lesson.unitNumber}
                </div>
                <TitleTag className="unit-banner-title">
                  {unitState.lesson.title.replace(/^Unit \d+: /, "")}
                </TitleTag>
                <UnitMastery unitId={unitState.lesson.id} />
              </div>

              <div className="unit-track">
                <div className="unit-track-content">
                  {unitState.groups.map((group, groupIndex) => {
                    const unlocked = unitState.unitUnlocked && isGroupUnlocked(group, unitState.completedByGroupId, unitState.groupsById);
                    const selection = buildGroupSelection(unitState, group, unlocked);
                    const groupKey = getGroupSelectionKey(unitState.lesson.id, group.id);
                    const isSelected = selectedGroupKey === groupKey;
                    const islandOffset = getIslandOffset(groupIndex);

                    return (
                      <section
                        key={`${unitState.lesson.id}-${group.id}`}
                        className={`group-block ${isSelected ? "is-selected" : ""}`}
                        style={{
                          zIndex: isSelected ? 20 : 1,
                          animationDelay: `${140 + lessonIndex * 70 + groupIndex * 55}ms`,
                        }}
                      >
                        <div
                          className={`group-anchor ${groupIndex % 2 === 1 ? "align-right" : ""}`}
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            marginLeft: groupIndex % 2 === 1 ? "auto" : islandOffset.marginLeft,
                            marginRight: islandOffset.marginRight,
                          }}
                        >
                          <GroupIsland
                            group={group}
                            completedCount={selection.completedCount}
                            unlocked={unlocked}
                            showProgress={unitState.unitUnlocked && group.id === unitState.currentGroupId}
                            selected={isSelected}
                            alignRight={groupIndex % 2 === 1}
                            onClick={() => {
                              if (!unitState.unitUnlocked) {
                                return;
                              }

                              setSelectedGroupKey((current) => (current === groupKey ? null : groupKey));
                            }}
                            interactive={unitState.unitUnlocked}
                            theme={unitState.theme}
                          />

                          {isSelected ? (
                            <GroupPopup
                              lessonId={unitState.lesson.id}
                              selection={selection}
                              pressed={pressedStartGroupKey === groupKey}
                              onPressStart={() => setPressedStartGroupKey(groupKey)}
                              onPressEnd={() => setPressedStartGroupKey(null)}
                            />
                          ) : null}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <style jsx global>{`
        .unit-map-page {
          min-height: var(--page-content-height);
          background: linear-gradient(180deg, ${UNIT_SURFACE.bgTop} 0%, ${UNIT_SURFACE.bgBottom} 100%);
          color: ${UNIT_SURFACE.textPrimary};
          padding: 16px 16px 48px;
          overflow-x: hidden;
        }

        .unit-map-shell {
          max-width: 460px;
          margin: 0 auto;

        }

        .course-map-shell {
          display: flex;
          flex-direction: column;
          gap: 34px;
        }

        .course-unit-block {
          scroll-margin-top: 24px;
        }

        .map-top-row {
          margin-bottom: 14px;
          opacity: 0;
          animation: unit-map-fade-up 360ms cubic-bezier(0.22, 1, 0.36, 1) 40ms forwards;
        }

        .map-back-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 999px;
          text-decoration: none;
          color: ${UNIT_SURFACE.textPrimary};
          border: 1px solid var(--border-color);
          background: var(--surface-1);
          font-size: 16px;
          font-weight: 500;
        }

        .unit-banner {
          display: block;
          border-radius: 20px;
          padding: 16px 18px;
          background: linear-gradient(180deg, var(--unit-banner-top) 0%, var(--unit-banner-bottom) 100%);
          color: var(--unit-popup-text);
          box-shadow: inset 0 -6px 0 rgba(24, 38, 57, 0.28);
          opacity: 0;
          animation: unit-map-fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) 90ms forwards;
        }

        .unit-banner.is-locked {
          opacity: 0.78;
          filter: saturate(0.78);
        }

        .unit-banner-kicker {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.7px;
          opacity: 0.9;
        }

        .unit-banner-title {
          margin: 6px 0 0;
          font-size: clamp(26px, 6vw, 38px);
          line-height: 1.04;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .unit-track {
          margin-top: 28px;
        }

        .unit-track-content {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: calc(var(--page-content-height) - 260px);
          gap: 22px;
        }

        .group-block {
          position: relative;
          overflow: visible;
          opacity: 0;
          animation: unit-map-node-rise 480ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .next-unit-preview {
          margin-top: 32px;
          padding-top: 6px;
        }

        .next-unit-banner {
          display: block;
          text-decoration: none;
        }

        .next-unit-banner.is-locked {
          cursor: default;
          opacity: 0.78;
          filter: saturate(0.78);
          pointer-events: none;
        }

        .next-unit-preview-chip {
          display: inline-flex;
          align-items: center;
          margin-bottom: 10px;
          padding: 6px 12px;
          border-radius: 999px;
          background: var(--surface-1);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.6px;
          text-transform: uppercase;
        }

        .next-unit-summary {
          margin: 12px 0 0;
          max-width: 30ch;
          color: rgba(241, 235, 222, 0.84);
          font-size: 15px;
          line-height: 1.4;
          font-weight: 600;
        }

        .next-unit-track {
          display: flex;
          flex-direction: column;
          gap: 22px;
          margin-top: 24px;
          min-height: 0;
        }

        .next-unit-group-block {
          opacity: 0;
        }

        .group-anchor {
          position: relative;
          display: flex;
          align-items: flex-start;
          min-height: ${ISLAND_OUTER_SIZE}px;
          width: fit-content;
          max-width: 100%;
        }

        .group-anchor.has-jump-here {
          padding-top: 132px;
        }

        .group-anchor.align-right {
          align-items: flex-end;
        }

        .jump-here-wrap {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 8;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .jump-here-bubble {
          position: relative;
          min-width: 172px;
          padding: 14px 18px;
          border-radius: 22px;
          background: rgba(37, 49, 66, 0.96);
          border: 1px solid rgba(var(--unit-active-ring-rgb), 0.26);
          box-shadow:
            inset 0 -2px 0 rgba(14, 22, 32, 0.32),
            0 10px 24px rgba(18, 26, 36, 0.16);
          color: var(--unit-active-ring);
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 1px;
          line-height: 1;
          text-transform: uppercase;
          text-align: center;
          white-space: nowrap;
        }

        .jump-here-bubble::after {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -11px;
          width: 22px;
          height: 22px;
          transform: translateX(-50%) rotate(45deg);
          border-radius: 5px 0 0 0;
          background: rgba(37, 49, 66, 0.96);
          border-right: 1px solid rgba(var(--unit-active-ring-rgb), 0.26);
          border-bottom: 1px solid rgba(var(--unit-active-ring-rgb), 0.26);
          box-sizing: border-box;
        }

        .jump-here-link {
          position: relative;
          display: block;
          width: 96px;
          height: 96px;
          text-decoration: none;
        }

        .jump-here-link-base,
        .jump-here-link-face {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          transition:
            transform 150ms cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 150ms ease,
            opacity 120ms ease;
        }

        .jump-here-link-base {
          top: 8px;
          background: rgba(var(--unit-active-ring-rgb), 0.42);
          opacity: 0.64;
        }

        .jump-here-link-face {
          bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, var(--unit-bubble-active-top) 0%, var(--unit-bubble-active-bottom) 100%);
          box-shadow:
            inset 0 -7px 0 rgba(24, 38, 57, 0.28),
            0 12px 30px rgba(var(--unit-active-ring-rgb), 0.2);
        }

        .jump-here-link:hover .jump-here-link-face,
        .jump-here-link:focus-visible .jump-here-link-face {
          transform: translateY(-2px);
        }

        .jump-here-link:active .jump-here-link-face {
          transform: translateY(6px) scale(0.985);
          box-shadow: inset 0 -2px 0 rgba(24, 38, 57, 0.2);
        }

        .jump-here-link:active .jump-here-link-base {
          opacity: 0;
        }

        .jump-here-icon {
          width: 38px;
          height: 38px;
          background: #ffffff;
          -webkit-mask-image: url("/octicons-playback-fast-forward.svg");
          mask-image: url("/octicons-playback-fast-forward.svg");
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-position: center;
          mask-position: center;
          -webkit-mask-size: contain;
          mask-size: contain;
          filter: drop-shadow(0 1px 1px rgba(18, 28, 40, 0.18));
        }

        .group-island-shell.is-current::before {
          content: "";
          position: absolute;
          inset: -10px;
          border-radius: 999px;
          background: radial-gradient(
            circle,
            rgba(var(--unit-active-ring-rgb), 0.28) 0%,
            rgba(var(--unit-active-ring-rgb), 0.18) 42%,
            rgba(var(--unit-active-ring-rgb), 0) 74%
          );
          pointer-events: none;
          animation: current-group-halo 1.7s ease-in-out infinite;
        }

        .group-segmented-ring.is-pulsing {
          filter: drop-shadow(0 0 12px rgba(var(--unit-active-ring-rgb), 0.34));
          animation: current-group-pulse 1.7s ease-in-out infinite;
          transform-origin: center;
        }

        .group-popup {
          position: absolute;
          top: 96px;
          left: 0;
          width: min(360px, calc(100vw - 64px));
          border-radius: 24px;
          padding: 18px;
          transform-origin: top center;
          animation: popup-grow 220ms cubic-bezier(0.22, 1, 0.36, 1);
          z-index: 5;
        }

        .group-popup.is-unlocked {
          background: linear-gradient(180deg, var(--unit-popup-top) 0%, var(--unit-popup-bottom) 100%);
          color: var(--unit-popup-text);
          box-shadow: inset 0 -6px 0 rgba(24, 38, 57, 0.28), 0 18px 36px rgba(43, 65, 96, 0.18);
        }

        .group-popup.is-locked {
          background: linear-gradient(180deg, rgba(43, 56, 72, 0.98) 0%, rgba(30, 40, 53, 0.98) 100%);
          border: 1px solid rgba(125, 141, 159, 0.24);
          color: #c7d1de;
          box-shadow: 0 24px 48px rgba(20, 28, 39, 0.22);
        }

        .group-popup-nub {
          position: absolute;
          top: -10px;
          width: 22px;
          height: 22px;
          transform: translateX(-50%) rotate(45deg);
          border-radius: 5px 0 0 0;
          background: inherit;
        }

        .group-popup-title {
          font-size: 28px;
          font-weight: 800;
          line-height: 1.05;
        }

        .group-popup-copy {
          margin-top: 6px;
          font-size: 18px;
          color: inherit;
          font-weight: 700;
        }

        .group-popup.is-locked .group-popup-title {
          color: #c9d3df;
        }

        .group-popup.is-locked .group-popup-copy {
          color: rgba(201, 211, 223, 0.64);
        }

        .start-link {
          position: relative;
          display: block;
          margin-top: 16px;
          width: 100%;
          min-height: 84px;
          border: none;
          background: transparent;
          padding: 0;
          text-decoration: none;
          cursor: pointer;
        }

        .start-link-base,
        .start-link-face {
          position: absolute;
          left: 0;
          right: 0;
          border-radius: 18px;
          transition:
            transform 150ms cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 150ms ease,
            background 150ms ease,
            opacity 120ms ease;
        }

        .start-link-base {
          top: 8px;
          bottom: 0;
          background: rgba(114, 124, 140, 0.34);
          border-radius: 18px;
        }

        .start-link-face {
          top: 0;
          bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, var(--unit-popup-button-top) 0%, var(--unit-popup-button-bottom) 100%);
          color: var(--unit-popup-button-text);
          font-size: 19px;
          font-weight: 900;
          letter-spacing: 0.5px;
          box-shadow: inset 0 -3px 0 rgba(190, 182, 164, 0.9);
          transform: translateY(0) scale(1);
          transform-origin: center center;
        }

        .start-link.is-pressed .start-link-face,
        .start-link:active .start-link-face {
          transform: translateY(8px) scale(0.985);
          box-shadow: inset 0 -1px 0 rgba(190, 182, 164, 0.64);
        }

        .start-link.is-pressed .start-link-base,
        .start-link:active .start-link-base {
          opacity: 0;
        }

        .start-link.locked {
          min-height: 64px;
          cursor: default;
        }

        .start-link.locked .start-link-base {
          top: 0;
          background: rgba(24, 34, 46, 0.24);
          opacity: 0;
        }

        .start-link.locked .start-link-face {
          top: 0;
          bottom: 0;
          transform: none;
          background: linear-gradient(180deg, rgba(95, 109, 127, 0.88) 0%, rgba(77, 91, 109, 0.88) 100%);
          color: rgba(233, 239, 245, 0.78);
          box-shadow: inset 0 -2px 0 rgba(58, 69, 83, 0.28);
        }

        @keyframes popup-grow {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.94, 0.78);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1, 1);
          }
        }

        @keyframes unit-map-shell-rise {
          from {
            transform: translateY(18px);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes unit-map-fade-up {
          from {
            opacity: 0;
            transform: translateY(18px);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes unit-map-node-rise {
          from {
            opacity: 0;
            transform: translateY(28px) scale(0.96);
            filter: blur(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes current-group-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.76;
            transform: scale(1.08);
          }
        }

        @keyframes current-group-halo {
          0%,
          100% {
            opacity: 0.34;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.92;
            transform: scale(1.14);
          }
        }

        @media (min-width: 900px) {
          .unit-map-shell {
            max-width: 860px;
          }

          .unit-track-content {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 54px 40px;
            min-height: auto;
          }

          .group-anchor {
            min-height: 108px;
          }
        }

        @media (max-width: 420px) {
          .jump-here-bubble {
            min-width: 154px;
            padding: 12px 16px;
            font-size: 15px;
            letter-spacing: 0.8px;
          }

          .jump-here-link {
            width: 90px;
            height: 90px;
          }

          .jump-here-icon {
            width: 34px;
            height: 34px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .map-top-row, .unit-banner, .group-block { opacity: 1; }
          .group-island-shell.is-current::before,
          .group-segmented-ring.is-pulsing,
          .group-popup,
          .group-block,
          .unit-map-shell,
          .map-top-row,
          .unit-banner,
          .jump-here-link-base,
          .jump-here-link-face {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
