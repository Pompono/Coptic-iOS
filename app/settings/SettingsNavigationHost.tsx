'use client';

import { usePathname, useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { registerSettingsNavigation } from '@/lib/settingsNavigation';
import { isSettingsRoute, normalizeSettingsPath, readSettingsHistory, SETTINGS_HISTORY_KEY, settingsTransforms, settingsParent, settingsDragIntent, settingsDragCompletes, type SettingsHistory } from '@/lib/settingsStack';
import SettingsHome from './SettingsHome';
import SettingsSubpage from './Subpage';
import './navigation.css';

type Page = { path: string; y: number };
type Scene = { from: Page; to: Page; direction: 'forward' | 'back'; progress: number; end: number; kind: 'settling' | 'tracking' | 'waiting' };
type Pending = { path: string; direction: 'forward' | 'back'; history: SettingsHistory | null };
type Drag = { x: number; y: number; lastX: number; lastTime: number; velocity: number; width: number; accepted: boolean; to: Page };

function Surface({ path, preview }: { path: string; preview: boolean }) {
  return path === '/settings' ? <SettingsHome/> : <SettingsSubpage section={path.split('/').at(-1) ?? ''} preview={preview}/>;
}

/** Owns real React surfaces, never cached App Router children or DOM snapshots. */
export default function SettingsNavigationHost() {
  const path = normalizeSettingsPath(usePathname());
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState<Page>({ path, y: 0 });
  const [scene, setScene] = useState<Scene | null>(null);
  const [, refresh] = useState(0);
  const live = useRef({ current, scene, pending: null as Pending | null, history: null as SettingsHistory | null,
    animations: [] as Animation[], disabled: false, leaving: false, disposed: false, scroll: 0, restore: null as number | null, timer: 0, drag: null as Drag | null, focus: false });
  const state = live.current;

  function motionAvailable() {
    try {
      return !state.disabled && sessionStorage.getItem('coptic-settings-motion') !== 'off'
        && !matchMedia('(prefers-reduced-motion: reduce)').matches
        && typeof Element.prototype.animate === 'function' && 'inert' in HTMLElement.prototype;
    } catch { return false; }
  }
  function cancelAnimations() {
    const animations = state.animations;
    state.animations = [];
    animations.forEach(animation => animation.cancel());
  }
  function show(page: Page, focus = false) {
    cancelAnimations();
    state.current = page; state.scene = null; state.restore = page.y; state.drag = null;
    state.focus = focus;
    setCurrent(page); setScene(null);
  }
  function saveHistory(history: SettingsHistory) {
    state.history = history;
    try { window.history.replaceState({ ...window.history.state, [SETTINGS_HISTORY_KEY]: history }, ''); }
    catch { state.disabled = true; }
  }
  function finish(value: Scene) {
    if (state.scene !== value || state.disposed) return;
    show(value.end === 1 ? value.to : value.from, value.end === 1);
  }
  function begin(value: Scene) {
    cancelAnimations(); state.scene = value; setScene(value);
  }
  function navigate(href: string, direction: 'forward' | 'back', gesture = false) {
    const destination = normalizeSettingsPath(new URL(href, window.location.href).pathname);
    if (!isSettingsRoute(destination) || state.leaving || state.pending || (state.scene && !gesture) || destination === state.current.path) return;
    const history = state.history!;
    const source = { path: state.current.path, y: Math.max(0, window.scrollY) };
    state.scroll = source.y;
    saveHistory({ ...history, y: source.y });
    const previous = history.trail.at(-1);
    const back = direction === 'back' && previous?.path === destination;
    const nextHistory = back ? null : {
      path: destination, y: 0, session: history.session, index: direction === 'forward' ? history.index + 1 : 0,
      trail: direction === 'forward' ? [...history.trail, source].slice(-32) : [],
    };
    state.pending = { path: destination, direction, history: nextHistory };
    refresh(value => value + 1);
    // A failed route request releases the lock, never cleans up page copies.
    state.timer = window.setTimeout(() => {
      state.pending = null; state.disabled = true; refresh(value => value + 1);
      if (state.scene) show(state.scene.from);
    }, 8000);
    if (back) router.back();
    else if (direction === 'back') router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  function startDrag(x: number, y: number, target: EventTarget | null) {
    const parent = settingsParent(state.current.path);
    if (!parent || !motionAvailable() || state.scene || state.pending || state.leaving || !host.current || !state.history) return;
    const bounds = host.current.getBoundingClientRect();
    if (x < bounds.left || x > bounds.left + 24 || window.scrollY < 0 || (window.visualViewport?.scale ?? 1) > 1.05) return;
    if (!(target instanceof Element) || target.closest('input,textarea,select,button,a,[contenteditable]:not([contenteditable=false]),[role=slider],[data-settings-no-swipe],[data-horizontal-scroll]') || window.getSelection()?.toString()) return;
    // Do not arbitrate an edge drag inside a horizontally scrollable control.
    for (let node: Element | null = target; node && node !== host.current; node = node.parentElement) {
      if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return;
    }
    const previous = state.history.trail.at(-1);
    state.drag = { x, y, lastX: x, lastTime: performance.now(), velocity: 0, width: bounds.width, accepted: false,
      to: { path: parent, y: previous?.path === parent ? previous.y : 0 } };
  }
  function moveDrag(x: number, y: number, event: Event) {
    const drag = state.drag;
    if (!drag) return;
    const dx = x - drag.x;
    if (!drag.accepted) {
      const intent = settingsDragIntent(dx, y - drag.y);
      if (intent === 'wait') return;
      if (intent === 'reject' || !event.cancelable) { state.drag = null; return; }
      drag.accepted = true;
      state.scroll = Math.max(0, window.scrollY);
      begin({ from: { path: state.current.path, y: state.scroll }, to: drag.to, direction: 'back', progress: 0, end: 0, kind: 'tracking' });
    }
    if (!event.cancelable) { endDrag(true); return; }
    event.preventDefault();
    const now = performance.now();
    drag.velocity = (x - drag.lastX) / Math.max(1, now - drag.lastTime);
    drag.lastX = x; drag.lastTime = now;
    const progress = Math.max(0, Math.min(1, dx / drag.width));
    if (state.scene) { state.scene.progress = progress; }
    // Update compositor transforms directly per touch sample. React owns the
    // nodes and lifecycle; no rendering, copying or routing happens here.
    const transforms = settingsTransforms('back', progress);
    const from = host.current?.querySelector<HTMLElement>('[data-layer-role="from"]');
    const to = host.current?.querySelector<HTMLElement>('[data-layer-role="to"]');
    if (from) from.style.transform = `translate3d(${transforms.from}%,0,0)`;
    if (to) to.style.transform = `translate3d(${transforms.to}%,0,0)`;
  }
  function endDrag(cancelled: boolean) {
    const drag = state.drag;
    state.drag = null;
    if (!drag?.accepted || !state.scene) return;
    const velocity = performance.now() - drag.lastTime > 100 ? 0 : drag.velocity;
    const commit = !cancelled && settingsDragCompletes(state.scene.progress * drag.width, drag.width, velocity);
    if (commit) {
      begin({ ...state.scene, kind: 'waiting', end: 0 });
      navigate(drag.to.path, 'back', true);
    } else begin({ ...state.scene, kind: 'settling', end: 0 });
  }

  useLayoutEffect(() => {
    state.disposed = false;
    state.leaving = false;
    const priorRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const history = readSettingsHistory(window.history.state?.[SETTINGS_HISTORY_KEY], path)
      ?? { path, y: Math.max(0, window.scrollY), trail: [], session: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, index: 0 };
    saveHistory(history); state.scroll = history.y;
    show({ path, y: history.y });
    const unregister = registerSettingsNavigation({ navigate, leave: () => {
      state.leaving = true; state.pending = null; clearTimeout(state.timer);
      if (state.scene) show(state.scene.end === 1 ? state.scene.to : state.scene.from);
    } });
    const scroll = () => {
      if (state.scene || state.pending || state.leaving || normalizeSettingsPath(window.location.pathname) !== state.current.path) return;
      state.scroll = Math.max(0, window.scrollY);
      if (state.history) saveHistory({ ...state.history, y: state.scroll });
    };
    const interrupt = () => { state.drag = null; if (state.scene) finish(state.scene); };
    const visibility = () => { if (document.hidden) interrupt(); };
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let nativeListener: PluginListenerHandle | undefined;
    let disposed = false;
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', interrupt).then(listener => {
        if (disposed) void listener.remove(); else nativeListener = listener;
      }).catch(() => { state.disabled = true; interrupt(); });
    }
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', interrupt);
    window.addEventListener('pagehide', interrupt);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', interrupt);
    const element = host.current!;
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) { endDrag(true); return; }
      startDrag(event.touches[0].clientX, event.touches[0].clientY, event.target);
    };
    const touchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) { endDrag(true); return; }
      moveDrag(event.touches[0].clientX, event.touches[0].clientY, event);
    };
    const touchEnd = () => endDrag(false);
    const touchCancel = () => endDrag(true);
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      startDrag(event.clientX, event.clientY, event.target);
      if (state.drag) element.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => { if (event.pointerType === 'mouse') moveDrag(event.clientX, event.clientY, event); };
    const pointerUp = (event: PointerEvent) => { if (event.pointerType === 'mouse') endDrag(false); };
    const pointerCancel = (event: PointerEvent) => { if (event.pointerType === 'mouse') endDrag(true); };
    element.addEventListener('touchstart', touchStart, { passive: true });
    element.addEventListener('touchmove', touchMove, { passive: false });
    element.addEventListener('touchend', touchEnd); element.addEventListener('touchcancel', touchCancel);
    element.addEventListener('pointerdown', pointerDown); element.addEventListener('pointermove', pointerMove);
    element.addEventListener('pointerup', pointerUp); element.addEventListener('pointercancel', pointerCancel);
    return () => {
      state.disposed = true; unregister(); cancelAnimations(); clearTimeout(state.timer);
      disposed = true; void nativeListener?.remove();
      window.history.scrollRestoration = priorRestoration;
      window.removeEventListener('scroll', scroll); window.removeEventListener('resize', interrupt);
      window.removeEventListener('pagehide', interrupt); document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', interrupt);
      element.removeEventListener('touchstart', touchStart); element.removeEventListener('touchmove', touchMove);
      element.removeEventListener('touchend', touchEnd); element.removeEventListener('touchcancel', touchCancel);
      element.removeEventListener('pointerdown', pointerDown); element.removeEventListener('pointermove', pointerMove);
      element.removeEventListener('pointerup', pointerUp); element.removeEventListener('pointercancel', pointerCancel);
    };
    // This registration belongs to the persistent host, not individual routes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!isSettingsRoute(path) || state.leaving) return;
    // Browser Back can return to the source before a push animation finishes.
    // That route commit must cancel the scene, not let its destination win later.
    if (path === state.current.path) {
      if (state.scene) {
        clearTimeout(state.timer); state.pending = null;
        const restored = readSettingsHistory(window.history.state?.[SETTINGS_HISTORY_KEY], path);
        if (restored) saveHistory(restored);
        show({ path, y: restored?.y ?? state.scene.from.y });
      }
      return;
    }
    const pending = state.pending?.path === path ? state.pending : null;
    clearTimeout(state.timer); state.pending = null;
    const oldHistory = state.history!;
    const traversed = readSettingsHistory(window.history.state?.[SETTINGS_HISTORY_KEY], path);
    const history = pending?.history ?? traversed ?? { path, y: 0, trail: [], session: oldHistory.session, index: 0 };
    const direction = pending?.direction ?? (history.session === oldHistory.session && history.index < oldHistory.index ? 'back' : path === '/settings' ? 'back' : 'forward');
    const from = { path: state.current.path, y: state.scroll };
    const to = { path, y: history.y };
    saveHistory(history);
    if (state.scene?.kind === 'waiting' && state.scene.to.path === path && motionAvailable()) {
      begin({ ...state.scene, to, end: 1, kind: 'settling' });
    } else if (!motionAvailable() || state.scene) show(to);
    else begin({ from, to, direction, progress: 0, end: 1, kind: 'settling' });
    // usePathname is the App Router's route-commit signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useLayoutEffect(() => {
    if (state.restore !== null) {
      window.scrollTo({ top: state.restore, behavior: 'instant' });
      state.scroll = window.scrollY; state.restore = null;
    }
    if (state.focus && !scene && !state.leaving) {
      state.focus = false;
      const heading = host.current?.querySelector<HTMLElement>('h1');
      heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
    }
    if (!scene || scene.kind !== 'settling') return;
    const from = host.current?.querySelector<HTMLElement>('[data-layer-role="from"]');
    const to = host.current?.querySelector<HTMLElement>('[data-layer-role="to"]');
    if (!from || !to || !motionAvailable()) { finish(scene); return; }
    const start = settingsTransforms(scene.direction, scene.progress);
    const end = settingsTransforms(scene.direction, scene.end);
    try {
      const options: KeyframeAnimationOptions = { duration: 300, easing: 'cubic-bezier(.22,.68,0,1)', fill: 'both' };
      const animations = [from.animate([{ transform: `translate3d(${start.from}%,0,0)` }, { transform: `translate3d(${end.from}%,0,0)` }], options),
        to.animate([{ transform: `translate3d(${start.to}%,0,0)` }, { transform: `translate3d(${end.to}%,0,0)` }], options)];
      state.animations = animations;
      void Promise.all(animations.map(animation => animation.finished)).then(() => finish(scene)).catch(() => {
        if (state.animations === animations) { state.disabled = true; finish(scene); }
      });
    } catch { state.disabled = true; finish(scene); }
    return cancelAnimations;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, current]);

  if (!isSettingsRoute(path)) return null;
  const transforms = scene ? settingsTransforms(scene.direction, scene.progress) : null;
  const pages = scene ? [scene.from, scene.to] : [current];
  return <div ref={host} className="settings-navigation-host" data-settings-phase={scene?.kind ?? (state.pending ? 'pending' : 'idle')}
    style={scene ? { minHeight: `calc(100svh + ${Math.max(scene.from.y, scene.to.y)}px)` } : undefined}>
    {pages.map((page, index) => {
      const role = scene ? index === 0 ? 'from' : 'to' : 'current';
      const inactive = Boolean(scene) || Boolean(state.pending);
      const style: CSSProperties = scene ? {
        position: index === 1 ? 'absolute' : 'relative', left: 0, top: index === 1 ? scene.from.y - scene.to.y : undefined,
        zIndex: scene.direction === 'forward' ? index + 1 : 2 - index,
        transform: `translate3d(${index === 0 ? transforms!.from : transforms!.to}%,0,0)`,
        minHeight: `calc(100svh + ${page.y}px)`,
      } : {};
      return <div key={page.path} data-settings-layer={page.path} data-layer-role={role} className="settings-navigation-surface"
        ref={node => { if (node) node.inert = inactive; }} aria-hidden={scene && index === 0 ? true : undefined} style={style}>
        <Surface path={page.path} preview={Boolean(scene && index === 1 && path !== page.path)}/>
      </div>;
    })}
  </div>;
}
