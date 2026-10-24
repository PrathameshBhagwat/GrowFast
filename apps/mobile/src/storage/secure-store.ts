const TOKEN_KEY = 'growfast_auth_token';
const USER_KEY = 'growfast_user_session';

export interface MobileUserSession {
  id: string;
  name: string;
  phone: string;
  role: string;
  storeId: string;
  storeName?: string;
}

const memoryFallback = new Map<string, string>();

async function getSecureStore() {
  try {
    return await import('expo-secure-store');
  } catch {
    return null;
  }
}

export async function saveAuthToken(token: string): Promise<void> {
  const store = await getSecureStore();
  if (store && typeof store.setItemAsync === 'function') {
    await store.setItemAsync(TOKEN_KEY, token);
  } else {
    memoryFallback.set(TOKEN_KEY, token);
  }
}

export async function getAuthToken(): Promise<string | null> {
  const store = await getSecureStore();
  if (store && typeof store.getItemAsync === 'function') {
    return await store.getItemAsync(TOKEN_KEY);
  }
  return memoryFallback.get(TOKEN_KEY) || null;
}

export async function removeAuthToken(): Promise<void> {
  const store = await getSecureStore();
  if (store && typeof store.deleteItemAsync === 'function') {
    await store.deleteItemAsync(TOKEN_KEY);
  }
  memoryFallback.delete(TOKEN_KEY);
}

export async function saveUserSession(session: MobileUserSession): Promise<void> {
  const str = JSON.stringify(session);
  const store = await getSecureStore();
  if (store && typeof store.setItemAsync === 'function') {
    await store.setItemAsync(USER_KEY, str);
  } else {
    memoryFallback.set(USER_KEY, str);
  }
}

export async function getUserSession(): Promise<MobileUserSession | null> {
  let data: string | null = null;
  const store = await getSecureStore();
  if (store && typeof store.getItemAsync === 'function') {
    data = await store.getItemAsync(USER_KEY);
  } else {
    data = memoryFallback.get(USER_KEY) || null;
  }
  if (!data) return null;
  try {
    return JSON.parse(data) as MobileUserSession;
  } catch {
    return null;
  }
}

export async function clearUserSession(): Promise<void> {
  await removeAuthToken();
  const store = await getSecureStore();
  if (store && typeof store.deleteItemAsync === 'function') {
    await store.deleteItemAsync(USER_KEY);
  }
  memoryFallback.delete(USER_KEY);
}
