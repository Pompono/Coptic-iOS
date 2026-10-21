export type SettingsEntry = { path: string; y: number };
export type SettingsHistory = { path: string; y: number; trail: SettingsEntry[]; session: string };
export const SETTINGS_HISTORY_KEY = 'copticSettingsStack';
export const normalizeSettingsPath = (path: string) => path.replace(/\/$/, '');
const sections = new Set(['account', 'preferences', 'learning', 'progress', 'recovery', 'developer']);
export function isSettingsRoute(path: string) {
  const clean = normalizeSettingsPath(path);
  return clean === '/settings' || (clean.startsWith('/settings/') && sections.has(clean.slice(10)));
}
export function settingsParent(path: string) {
  return path === '/settings' ? null : path === '/settings/recovery' ? '/settings/progress' : '/settings';
}
export function readSettingsHistory(value: unknown, path: string): SettingsHistory | null {
  const item = value as SettingsHistory | undefined;
  if (!item || item.path !== path || typeof item.session !== 'string' || !Number.isFinite(item.y) || item.y < 0 || !Array.isArray(item.trail)) return null;
  if (item.trail.length > 32 || item.trail.some(entry => !entry || !isSettingsRoute(entry.path) || !Number.isFinite(entry.y) || entry.y < 0)) return null;
  return item;
}
export function settingsTransforms(direction: 'forward' | 'back', progress: number) {
  return direction === 'forward'
    ? { from: -25 * progress, to: 100 * (1 - progress) }
    : { from: 100 * progress, to: -25 * (1 - progress) };
}
