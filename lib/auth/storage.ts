export interface AsyncStringStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SyncStringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createAuthStorage(
  isNative: boolean,
  keychain: AsyncStringStorage,
  browser: SyncStringStorage,
): AsyncStringStorage {
  return {
    getItem: async key => isNative ? keychain.getItem(key) : browser.getItem(key),
    setItem: async (key, value) => {
      if (isNative) await keychain.setItem(key, value);
      else browser.setItem(key, value);
    },
    removeItem: async key => {
      if (isNative) await keychain.removeItem(key);
      else browser.removeItem(key);
    },
  };
}

export function browserAuthStorage(): SyncStringStorage {
  return {
    getItem: key => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: key => window.localStorage.removeItem(key),
  };
}
