let tail: Promise<void> = Promise.resolve();

/** Serializes lifecycle, manual sync, and explicit conflict choices on this device. */
export async function acquireProgressSyncLock(): Promise<() => void> {
  const previous = tail;
  let release!: () => void;
  tail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  return release;
}

export async function withProgressSyncLock<T>(operation: () => Promise<T>): Promise<T> {
  const release = await acquireProgressSyncLock();
  try { return await operation(); }
  finally { release(); }
}
