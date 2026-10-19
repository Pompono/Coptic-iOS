export interface RefreshController {
  startAutoRefresh(): Promise<void>;
  stopAutoRefresh(): Promise<void>;
}

export interface NativeAppLifecycle {
  getState(): Promise<{ isActive: boolean }>;
  addListener(
    event: 'appStateChange',
    callback: (state: { isActive: boolean }) => void,
  ): Promise<{ remove(): Promise<void> }>;
}

export async function bindNativeAuthLifecycle(
  auth: RefreshController,
  app: NativeAppLifecycle,
): Promise<() => Promise<void>> {
  const listener = await app.addListener('appStateChange', state => {
    if (state.isActive) void auth.startAutoRefresh();
    else void auth.stopAutoRefresh();
  });
  try {
    if ((await app.getState()).isActive) await auth.startAutoRefresh();
    else await auth.stopAutoRefresh();
  } catch (error) {
    await listener.remove();
    throw error;
  }
  return () => listener.remove();
}
