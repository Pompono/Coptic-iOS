"use client";
import PageHeader from "@/app/PageHeader";
import AppIcon from "@/app/AppIcon";

import Link from "@/lib/AppLink";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { lessonSections, lessons, type Lesson, type UnitLessonStep, type UnitProgressGroup } from "@/lib/lesson";
import { readCompletedSteps, readFailedSteps } from "../progress";

// In-memory state lasts until this WebView closes, unlike persisted progress.
const visitedPathways = new Set<string>();

type GroupSelection = {
  group: UnitProgressGroup;
  step: UnitLessonStep;
  unlocked: boolean;
  completedCount: number;
  currentLessonNumber: number;
  isCurrentLessonCompleted: boolean;
  hasCurrentLessonFailed: boolean;
};

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

export default function UnitProgressClient({ focusLessonId = null }: { focusLessonId?: string | null }) {
  const [completedStepIdsByLessonId, setCompletedStepIdsByLessonId] = useState<Record<string, string[]>>({});
  const [failedStepIdsByLessonId, setFailedStepIdsByLessonId] = useState<Record<string, string[]>>({});
  const [hasLoadedProgress, setHasLoadedProgress] = useState(false);
  const unitSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pathRoot = useRef<HTMLElement>(null);
  const pathHeading = useRef<HTMLDivElement>(null);
  const firstVisit = useRef(false);
  const visitKey = useRef<string | null>(null);


  useLayoutEffect(() => {
    const heading = pathHeading.current;
    if (!heading) return;
    const measure = () => pathRoot.current?.style.setProperty('--learning-header-height', `${heading.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  const pinnedHeight = (unit:HTMLElement) => (pathHeading.current?.getBoundingClientRect().height ?? 0) + (unit.querySelector('.unit-banner')?.getBoundingClientRect().height ?? 0);

  useLayoutEffect(() => {
    const nextCompletedStepIdsByLessonId = Object.fromEntries(
      lessons.map((entry) => [entry.id, (readCompletedSteps(entry.id) ?? [])])
    ) as Record<string, string[]>;
    const nextFailedStepIdsByLessonId = Object.fromEntries(
      lessons.map((entry) => [entry.id, (readFailedSteps(entry.id) ?? [])])
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
    if (!hasLoadedProgress || !targetLesson) return;
    const unit = unitSectionRefs.current[targetLesson.id];
    if (!unit) return;
    const key = `${targetLesson.sectionId}:${focusLessonId ?? "index"}`;
    if (visitKey.current !== key) {
      visitKey.current = key;
      firstVisit.current = !visitedPathways.has(targetLesson.sectionId);
      visitedPathways.add(targetLesson.sectionId);
    }
    if (firstVisit.current) {
      window.scrollTo({top:0,left:0,behavior:"instant"});
    } else {
      const node = unit.querySelector<HTMLElement>(".course-row.is-current") ?? unit;
      const shell = document.querySelector(".mobile-chin-page-shell");
      const inset = pinnedHeight(unit) + 12 + (shell ? parseFloat(getComputedStyle(shell).paddingTop) || 0 : 0);
      window.scrollTo({top:Math.max(0,node.getBoundingClientRect().top + window.scrollY - inset),left:0,behavior:"instant"});
    }
  }, [hasLoadedProgress, targetLesson, focusLessonId]);

  useEffect(() => {
    if (!hasLoadedProgress || !targetLesson || !firstVisit.current) return;
    const unit = unitSectionRefs.current[targetLesson.id];
    if (!unit) return;
    const node = unit.querySelector<HTMLElement>(".course-row.is-current") ?? unit;
    let frame = 0;
    let cancelled = false;
    const cancel = () => {cancelled=true;cancelAnimationFrame(frame);};
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const shell = document.querySelector(".mobile-chin-page-shell");
        const visibleTop = pinnedHeight(unit) + (shell ? parseFloat(getComputedStyle(shell).paddingTop) || 0 : 0);
        const dock = document.querySelector(".mobile-chin-dock");
        const bottomInset = dock ? dock.getBoundingClientRect().height : 0;
        const bounds = node.getBoundingClientRect();
        if (bounds.bottom > visibleTop && bounds.top < innerHeight-bottomInset) return;
        const start = window.scrollY;
        const target = Math.max(0,bounds.top+start-visibleTop-12);
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
          window.scrollTo({top:target,behavior:"instant"});return;
        }
        let began:number|null = null;
        const step = (timestamp:number) => {
          if (cancelled) return;
          began ??= timestamp;
          const progress = Math.min((timestamp-began)/360,1);
          window.scrollTo({top:start+(target-start)*(1-Math.pow(1-progress,3)),behavior:"instant"});
          if (progress<1) frame=requestAnimationFrame(step);
        };
        frame=requestAnimationFrame(step);
      });
    });
    window.addEventListener("touchstart",cancel,{passive:true});
    window.addEventListener("wheel",cancel,{passive:true});
    return () => {cancel();window.removeEventListener("touchstart",cancel);window.removeEventListener("wheel",cancel);};
  }, [hasLoadedProgress, targetLesson, focusLessonId]);

  return <main ref={pathRoot} className="unit-map-page app-page">
    <div ref={pathHeading} className="learning-path-heading"><PageHeader title="CoptLingo" icon="cross"/></div>
    <div className="course-map-shell">
      {visibleLessonStates.map(unitState => {
        const focused=unitState.lesson.id===targetLesson?.id;
        const availableSteps=unitState.groups.flatMap(g=>g.lessons).filter(step=>step.exerciseSet);
        const total=availableSteps.length;
        const complete=availableSteps.filter(step=>unitState.completedSet.has(step.id)).length;
        return <section data-unit-color={["pink","purple","blue","red","green","orange"][(unitState.lesson.unitNumber-1)%6]} key={unitState.lesson.id} ref={node=>{unitSectionRefs.current[unitState.lesson.id]=node;}} className={`course-unit-block ${focused?'is-focused':''} ${unitState.unitUnlocked?'':'is-locked'}`}>
          <header className="unit-banner"><div className="unit-banner-card"><h2 className="unit-banner-title">{unitState.lesson.title.replace(/^Unit \d+: /,'')}</h2><div className="unit-banner-subtitle">{unitState.lesson.sectionTitle} · Unit {unitState.lesson.unitNumber}</div>
            <div className="unit-progress-caption"><span>{unitState.isUnitFullyCompleted?'Completed':unitState.unitUnlocked?total>0&&complete===total?'Available practice complete':'In progress':'Upcoming'}</span><span>{total?`${complete} / ${total} lessons`:'Content coming soon'}</span></div>
            {unitState.unitUnlocked&&total>0&&<progress className="unit-progress" value={complete} max={total} aria-label={`Unit ${unitState.lesson.unitNumber} completion`}/>}
          </div></header>
          <ol className="course-timeline">
            {unitState.groups.map((group,index)=>{
              const unlocked=unitState.unitUnlocked&&isGroupUnlocked(group,unitState.completedByGroupId,unitState.groupsById);
              const selection=buildGroupSelection(unitState,group,unlocked);
              const completed=selection.completedCount>=group.totalLessons;
              const actionStep=completed&&group.kind==='lesson-group'&&group.reviewStep?group.reviewStep:selection.step;
              const playable=unlocked&&Boolean(actionStep?.exerciseSet);
              const current=group.id===unitState.currentGroupId;
              const action=completed?(group.reviewStep?'Review':'Replay lesson'):selection.hasCurrentLessonFailed?'Try Again':'Start';
              return <li key={group.id} className={`course-row ${current?'is-current':''} ${completed?'is-completed':''}`}>
                <span className="course-row-marker" aria-hidden="true">{completed?<AppIcon name="check" size={18}/>:!unlocked?<AppIcon name="lock" size={15}/>:current?<AppIcon name="cross" size={23}/>:index+1}</span>
                <div className="course-row-content"><div className="course-row-status">{completed?'Completed':current?'Next lesson':unlocked?'Ready':'Locked'}</div><h3>{group.kind==='review'?`Unit ${unitState.lesson.unitNumber} review`:group.subtitle}</h3>
                  <p>{!actionStep?.exerciseSet?'In preparation':group.kind==='review'?group.subtitle:`Lesson ${selection.currentLessonNumber} of ${group.totalLessons}`}</p>
                  {actionStep?.exerciseSet&&<p className="course-row-summary">{actionStep.summary}</p>}
                  {playable?<Link className={current?'ui-primary':'ui-secondary'} href={`/learn/${unitState.lesson.id}/play/${actionStep.id}/`}>{action}<AppIcon name="arrow" size={16}/></Link>:<span className="course-unavailable">{unlocked?'Content coming soon':'Complete earlier lessons to unlock'}</span>}
                </div>
              </li>;
            })}
          </ol>
        </section>;
      })}
    </div>
  </main>;
}
