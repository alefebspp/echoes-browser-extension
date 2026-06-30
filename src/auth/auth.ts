import {
  STORAGE_KEYS,
  DEFAULT_API_BASE_URL,
  BUILTIN_API_BASE_URL,
  IS_API_BASE_URL_LOCKED,
} from "../shared/constants";

export type AuthState = {
  token: string | null;
  isAuthenticated: boolean;
};

export async function getApiBaseUrl(): Promise<string> {
  if (IS_API_BASE_URL_LOCKED) {
    return BUILTIN_API_BASE_URL;
  }

  const result = await chrome.storage.local.get(STORAGE_KEYS.API_BASE_URL);
  return (result[STORAGE_KEYS.API_BASE_URL] as string | undefined) ?? DEFAULT_API_BASE_URL;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.API_BASE_URL]: url });
}

export async function getAuthToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_TOKEN);
  return (result[STORAGE_KEYS.AUTH_TOKEN] as string | undefined) ?? null;
}

export async function getAuthState(): Promise<AuthState> {
  const token = await getAuthToken();
  return {
    token,
    isAuthenticated: token !== null,
  };
}

export async function login(email: string, password: string): Promise<void> {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Login failed (${response.status})`);
  }

  const data = (await response.json()) as { token: string };
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TOKEN]: data.token });
}

export async function logout(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.AUTH_TOKEN);
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}
