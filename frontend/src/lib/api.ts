const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const TOKEN_KEY = "cit_token";

// sessionStorage: the login ends when the tab closes
export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: FieldError[];

  constructor(status: number, code: string, message: string, details?: FieldError[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Is the API running?");
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = data?.error;
    // A rejected token (expired, deactivated user) ends the session; a failed login has no token yet
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(
      res.status,
      err?.code ?? "ERROR",
      err?.message ?? `Request failed (${res.status})`,
      err?.details
    );
  }
  return data as T;
}
