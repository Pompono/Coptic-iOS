'use client';

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';
import { getSupabaseClient } from '@/lib/auth/client';
import { makeBackup } from '@/lib/progressStorage';
import {
  fetchProgressSnapshot, installCloudProgress, PROGRESS_SYNC_OPT_IN_KEY, readSyncBase,
  saveSyncBase, writeProgressSnapshot,
} from '@/lib/progressSync';
import { createProgressSyncCoordinator } from '@/lib/progressSyncCoordinator';

const LAST_USER_KEY = 'coptic-progress-sync-last-user:v1';
let activeController: AbortController | null = null;
const coordinator = createProgressSyncCoordinator({
  async currentUser() {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session?.user.id ?? null;
  },
  isEnabled(userId) { return localStorage.getItem(PROGRESS_SYNC_OPT_IN_KEY) === userId; },
  lastUser() { return localStorage.getItem(LAST_USER_KEY); },
  base: readSyncBase,
  local: () => makeBackup().records,
  async cloud(userId, signal) { return fetchProgressSnapshot(await getSupabaseClient(), userId, signal); },
  async upload(revision, records, signal) { return writeProgressSnapshot(await getSupabaseClient(), revision, records, signal); },
  install: installCloudProgress,
  saveBase: saveSyncBase,
  rememberUser(userId) { localStorage.setItem(LAST_USER_KEY, userId); },
});

export default function ProgressSyncLifecycle() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let removeAppState: { remove(): Promise<void> } | undefined;
    let authSubscription: { unsubscribe(): void } | undefined;
    const schedule = () => {
      if (disposed || !navigator.onLine || document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const controller = new AbortController();
        activeController = controller;
        void coordinator.request(controller.signal).catch(() => {
          // Offline, malformed remote data, or storage failures preserve local progress and baseline.
        }).finally(() => { if (activeController === controller) activeController = null; });
      }, 900);
    };
    window.addEventListener('coptic-progress-change', schedule);
    const stopCurrentSync = () => { activeController?.abort(); coordinator.cancel(); };
    window.addEventListener('coptic-progress-sync-optout', stopCurrentSync);
    window.addEventListener('online', schedule);
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', schedule);
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => { if (isActive) schedule(); })
        .then(listener => { if (disposed) void listener.remove(); else removeAppState = listener; });
    }
    void getSupabaseClient().then(client => {
      if (disposed) return;
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          activeController?.abort();
          schedule();
        }
      });
      authSubscription = data.subscription;
      if (disposed) authSubscription.unsubscribe();
    }).catch(() => { /* Auth is optional; local learning continues without it. */ });
    schedule();
    return () => {
      disposed = true;
      activeController?.abort();
      clearTimeout(timer);
      window.removeEventListener('coptic-progress-change', schedule);
      window.removeEventListener('coptic-progress-sync-optout', stopCurrentSync);
      window.removeEventListener('online', schedule);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', schedule);
      void removeAppState?.remove();
      authSubscription?.unsubscribe();
    };
  }, []);
  return null;
}
