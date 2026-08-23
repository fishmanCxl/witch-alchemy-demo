export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface WeChatStorageApi {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
}

function wechatStorage(): WeChatStorageApi | null {
  return (globalThis as typeof globalThis & { wx?: WeChatStorageApi }).wx ?? null;
}

export function createPlatformStorage(fallback: KeyValueStorage): KeyValueStorage {
  const api = wechatStorage();
  if (!api) return fallback;
  return {
    getItem(key: string): string | null {
      const value = api.getStorageSync(key);
      return typeof value === 'string' ? value : null;
    },
    setItem(key: string, value: string): void {
      api.setStorageSync(key, value);
    },
    removeItem(key: string): void {
      api.removeStorageSync(key);
    },
  };
}

