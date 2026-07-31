const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const DEFAULT_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const STORAGE_KEY = "atiende_auth";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.refreshToken ?? null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = "/login";
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;

  if (externalSignal?.aborted) {
    clearTimeout(timer);
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  const onAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onAbort, { once: true });

  return fetch(url, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onAbort);
  });
}

async function guardedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetchWithTimeout(url, init, timeoutMs);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(408, "El servidor tardó demasiado en responder. Inténtalo de nuevo.");
    }
    throw new ApiError(503, "No se pudo contactar el servidor. Verifica tu conexión.");
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
    if (typeof message === "string" && message) return message;
  } catch {
    // Body is not JSON — fall through to statusText
  }
  return res.statusText;
}

type RefreshOutcome = { ok: true } | { ok: false; reason: "expired" | "network" };

let refreshPromise: Promise<RefreshOutcome> | null = null;

async function tryRefreshToken(): Promise<RefreshOutcome> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<RefreshOutcome> => {
    const rt = getRefreshToken();
    if (!rt) return { ok: false, reason: "expired" };

    try {
      const res = await fetchWithTimeout(
        `${API_BASE}/api/auth/refresh`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt }),
        },
        DEFAULT_TIMEOUT_MS,
      );

      if (!res.ok) return { ok: false, reason: "expired" };

      const data = await res.json();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ok: false, reason: "expired" };

      const parsed = JSON.parse(raw);
      const newState = {
        ...parsed,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return { ok: true };
    } catch {
      return { ok: false, reason: "network" };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function coreRequest<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const buildHeaders = (): Record<string, string> => {
    const isForm = init.body instanceof FormData;
    const h: Record<string, string> = isForm ? {} : { "Content-Type": "application/json" };
    const token = getToken();
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  const url = `${API_BASE}${path}`;
  const doFetch = (h: Record<string, string>) =>
    guardedFetch(url, { ...init, headers: { ...h, ...init.headers } }, timeoutMs);

  let headers = buildHeaders();
  let res = await doFetch(headers);

  if (res.status === 401) {
    const outcome = await tryRefreshToken();
    if (outcome.ok) {
      headers = buildHeaders();
      res = await doFetch(headers);
    } else if (outcome.reason === "expired") {
      clearSession();
      throw new ApiError(401, "Sesión expirada");
    } else {
      throw new ApiError(
        503,
        "No se pudo renovar la sesión. Verifica tu conexión e inténtalo de nuevo.",
      );
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await readError(res));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    coreRequest<T>(path, { ...options, method: "GET" }, DEFAULT_TIMEOUT_MS),
  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    coreRequest<T>(path, { ...options, method: "POST", body: JSON.stringify(body) }, DEFAULT_TIMEOUT_MS),
  put: <T>(path: string, body?: unknown, options?: RequestInit) =>
    coreRequest<T>(path, { ...options, method: "PUT", body: JSON.stringify(body) }, DEFAULT_TIMEOUT_MS),
  delete: <T>(path: string, options?: RequestInit) =>
    coreRequest<T>(path, { ...options, method: "DELETE" }, DEFAULT_TIMEOUT_MS),
  upload: <T>(path: string, body: FormData) =>
    coreRequest<T>(path, { method: "POST", body }, UPLOAD_TIMEOUT_MS),
};
