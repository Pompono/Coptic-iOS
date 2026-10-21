'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { registerSettingsNavigation } from '@/lib/settingsNavigation';
import { isSettingsRoute, normalizeSettingsPath, readSettingsHistory, SETTINGS_HISTORY_KEY, settingsTransforms, type SettingsHistory } from '@/lib/settingsStack';
import SettingsHome from './SettingsHome';
import SettingsSubpage from './Subpage';
import './navigation.css';

type Page = { path: string; y: number };
type Scene = { from: Page; to: Page; direction: 'forward' | 'back'; progress: number; end: number; kind: 'settling' | 'tracking' | 'waiting' };
type Pending = { path: string; direction: 'forward' | 'back'; history: SettingsHistory | null };

function Surface({ path }: { path: string }) {
  return path === '/settings' ? <SettingsHome/> : <SettingsSubpage section={path.split('/').at(-1) ?? ''}/>;
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
    animations: [] as Animation[], disabled: false, leaving: false, disposed: false, scroll: 0, restore: null as number | null, timer: 0 });
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
    state.current = page; state.scene = null; state.restore = page.y;
    setCurrent(page); setScene(null);
    if (focus) queueMicrotask(() => {
      if (state.disposed || state.scene || state.leaving) return;
      const heading = host.current?.querySelector<HTMLElement>('h1');
      heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
    });
  }
  function saveHistory(history: SettingsHistory) {
    state.history = history;
    window.history.replaceState({ ...window.history.state, [SETTINGS_HISTORY_KEY]: history }, '');
  }
  function finish(value: Scene) {
    if (state.scene !== value || state.disposed) return;
    show(value.end === 1 ? value.to : value.from, value.end === 1);
  }
  function begin(value: Scene) {
    cancelAnimations(); state.scene = value; setScene(value);
  }
  function navigate(href: string, direction: 'forward' | 'back') {
    const destination = normalizeSettingsPath(new URL(href, window.location.href).pathname);
    if (!isSettingsRoute(destination) || state.leaving || state.pending || state.scene || destination === state.current.path) return;
    const history = state.history!;
    const source = { path: state.current.path, y: Math.max(0, window.scrollY) };
    state.scroll = source.y;
    saveHistory({ ...history, y: source.y });
    const previous = history.trail.at(-1);
    const back = direction === 'back' && previous?.path === destination;
    const nextHistory = back ? null : {
      path: destination, y: 0, session: history.session,
      trail: direction === 'forward' ? [...history.trail, source].slice(-32) : [],
    };
    state.pending = { path: destination, direction, history: nextHistory };
    refresh(value => value + 1);
    // A failed route request releases the lock, never cleans up page copies.
    state.timer = window.setTimeout(() => {
      state.pending = null; state.disabled = true; refresh(value => value + 1);
    }, 8000);
    if (back) router.back();
    else if (direction === 'back') router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  useLayoutEffect(() => {
    state.disposed = false;
    const priorRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    const history = readSettingsHistory(window.history.state?.[SETTINGS_HISTORY_KEY], path)
      ?? { path, y: Math.max(0, window.scrollY), trail: [], session: crypto.randomUUID() };
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
    const interrupt = () => { if (state.scene) finish(state.scene); };
    const visibility = () => { if (document.hidden) interrupt(); };
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', interrupt);
    window.addEventListener('pagehide', interrupt);
    document.addEventListener('visibilitychange', visibility);
    media.addEventListener('change', interrupt);
    return () => {
      state.disposed = true; unregister(); cancelAnimations(); clearTimeout(state.timer);
      window.history.scrollRestoration = priorRestoration;
      window.removeEventListener('scroll', scroll); window.removeEventListener('resize', interrupt);
      window.removeEventListener('pagehide', interrupt); document.removeEventListener('visibilitychange', visibility);
      media.removeEventListener('change', interrupt);
    };
    // This registration belongs to the persistent host, not individual routes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (path === state.current.path || !isSettingsRoute(path) || state.leaving) return;
    const pending = state.pending?.path === path ? state.pending : null;
    clearTimeout(state.timer); state.pending = null;
    const oldHistory = state.history!;
    const traversed = readSettingsHistory(window.history.state?.[SETTINGS_HISTORY_KEY], path);
    const history = pending?.history ?? traversed ?? { path, y: 0, trail: [], session: oldHistory.session };
    const direction = pending?.direction ?? (history.session === oldHistory.session && history.trail.length < oldHistory.trail.length ? 'back' : path === '/settings' ? 'back' : 'forward');
    const from = { path: state.current.path, y: state.scroll };
    const to = { path, y: history.y };
    saveHistory(history);
    if (!motionAvailable() || state.scene) show(to);
    else begin({ from, to, direction, progress: 0, end: 1, kind: 'settling' });
    // usePathname is the App Router's route-commit signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useLayoutEffect(() => {
    if (state.restore !== null) {
      window.scrollTo({ top: state.restore, behavior: 'instant' });
      state.scroll = window.scrollY; state.restore = null;
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
        position: index === 1 ? 'absolute' : 'relative', top: index === 1 ? scene.from.y - scene.to.y : undefined,
        zIndex: scene.direction === 'forward' ? index + 1 : 2 - index,
        transform: `translate3d(${index === 0 ? transforms!.from : transforms!.to}%,0,0)`,
        minHeight: `calc(100svh + ${page.y}px)`,
      } : {};
      return <div key={page.path} data-settings-layer={page.path} data-layer-role={role} className="settings-navigation-surface"
        ref={node => { if (node) node.inert = inactive; }} aria-hidden={scene && index === 0 ? true : undefined} style={style}>
        <Surface path={page.path}/>
      </div>;
    })}
  </div>;
}
