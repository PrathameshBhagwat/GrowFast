export const TOKEN_KEY = 'growfast_auth_token';
export const USER_KEY = 'growfast_user_session';

export interface MobileUserSession {
  id: string;
  name: string;
  phone: string;
  role: string;
  storeId: string;
  storeName?: string;
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * In-memory fallback adapter for SSR, test environments, or restricted storage.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private memory = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.memory.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.memory.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.memory.delete(key);
  }

  clear(): void {
    this.memory.clear();
  }
}

/**
 * Web localStorage adapter with SSR safety and in-memory fallback.
 */
export class WebStorageAdapter implements StorageAdapter {
  constructor(private fallback: StorageAdapter = new MemoryStorageAdapter()) {}

  private isLocalStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
        return false;
      }
      const testKey = '__growfast_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (this.isLocalStorageAvailable()) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return this.fallback.getItem(key);
      }
    }
    return this.fallback.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        return this.fallback.setItem(key, value);
      }
    }
    return this.fallback.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.isLocalStorageAvailable()) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {
        return this.fallback.removeItem(key);
      }
    }
    return this.fallback.removeItem(key);
  }
}

/**
 * Native Android/iOS SecureStore adapter using expo-secure-store.
 * Strictly checks isAvailableAsync() before executing native bridge calls.
 */
export class NativeSecureStoreAdapter implements StorageAdapter {
  private secureStore: any = null;
  private checked = false;
  private available = false;

  constructor(private fallback: StorageAdapter = new MemoryStorageAdapter()) {}

  private async getNativeStore() {
    if (this.checked) {
      return this.available ? this.secureStore : null;
    }
    this.checked = true;

    // Never call native SecureStore on Web or Node.js test environments
    const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node) && typeof window === 'undefined';
    if (isWeb || isNode) {
      this.available = false;
      return null;
    }

    try {
      const store = await import('expo-secure-store');
      if (store && typeof store.isAvailableAsync === 'function') {
        const isAvail = await store.isAvailableAsync();
        if (isAvail) {
          this.secureStore = store;
          this.available = true;
          return this.secureStore;
        }
      }
    } catch {
      // SecureStore not available or unsupported
    }

    this.available = false;
    return null;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const store = await this.getNativeStore();
      if (store && typeof store.getItemAsync === 'function') {
        return await store.getItemAsync(key);
      }
    } catch {
      // Native SecureStore failed, fall back
    }
    return this.fallback.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const store = await this.getNativeStore();
      if (store && typeof store.setItemAsync === 'function') {
        await store.setItemAsync(key, value);
        return;
      }
    } catch {
      // Native SecureStore failed, fall back
    }
    return this.fallback.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    try {
      const store = await this.getNativeStore();
      if (store && typeof store.deleteItemAsync === 'function') {
        await store.deleteItemAsync(key);
        return;
      }
    } catch {
      // Native SecureStore failed, fall back
    }
    return this.fallback.removeItem(key);
  }
}

// Global active adapter instance
let activeAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (activeAdapter) return activeAdapter;

  const memory = new MemoryStorageAdapter();
  const isWeb = typeof window !== 'undefined' && typeof window.document !== 'undefined';
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node) && typeof window === 'undefined';

  if (isWeb) {
    activeAdapter = new WebStorageAdapter(memory);
  } else if (isNode) {
    activeAdapter = memory;
  } else {
    activeAdapter = new NativeSecureStoreAdapter(memory);
  }
  return activeAdapter;
}

export function setStorageAdapterForTesting(adapter: StorageAdapter | null): void {
  activeAdapter = adapter;
}

export async function saveAuthToken(token: string): Promise<void> {
  if (!token || typeof token !== 'string') return;
  const adapter = getStorageAdapter();
  await adapter.setItem(TOKEN_KEY, token);
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const adapter = getStorageAdapter();
    const token = await adapter.getItem(TOKEN_KEY);
    if (!token || typeof token !== 'string' || token.trim() === '') {
      return null;
    }
    return token.trim();
  } catch {
    return null;
  }
}

export async function removeAuthToken(): Promise<void> {
  try {
    const adapter = getStorageAdapter();
    await adapter.removeItem(TOKEN_KEY);
  } catch {
    // Ignore removal errors
  }
}

export async function saveUserSession(session: MobileUserSession): Promise<void> {
  if (!session || typeof session !== 'object' || !session.id) return;
  const adapter = getStorageAdapter();
  const str = JSON.stringify(session);
  await adapter.setItem(USER_KEY, str);
}

export async function getUserSession(): Promise<MobileUserSession | null> {
  try {
    const adapter = getStorageAdapter();
    const data = await adapter.getItem(USER_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data) as MobileUserSession;
    if (!parsed || typeof parsed !== 'object' || !parsed.id) {
      await removeUserSession();
      return null;
    }
    return parsed;
  } catch {
    await removeUserSession();
    return null;
  }
}

export async function removeUserSession(): Promise<void> {
  try {
    const adapter = getStorageAdapter();
    await adapter.removeItem(USER_KEY);
  } catch {
    // Ignore removal errors
  }
}

export async function clearUserSession(): Promise<void> {
  await Promise.all([removeAuthToken(), removeUserSession()]);
}
