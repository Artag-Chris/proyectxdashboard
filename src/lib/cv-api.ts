// Cliente HTTP para la API de CV-Harness. Sesión independiente de la de
// atiende: JWT propio (payload {sub, email}, secreto propio) en otra key.
const API_BASE = process.env.NEXT_PUBLIC_CV_API_URL || "http://localhost:3100/api";
const STORAGE_KEY = "cvh_auth";

export class CvApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "CvApiError";
  }
}

export function getCvSession(): { email: string; accessToken: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

export function setCvSession(session: { email: string; accessToken: string }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearCvSession() {
  localStorage.removeItem(STORAGE_KEY);
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const msg = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
    if (typeof msg === "string" && msg) return msg;
  } catch {
    /* noop */
  }
  return res.statusText;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const headers: Record<string, string> = isForm
    ? {}
    : { "Content-Type": "application/json" };
  const session = getCvSession();
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearCvSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/cv")) {
      window.location.href = "/cv";
    }
    throw new CvApiError(401, "Sesión de CV Harness expirada");
  }
  if (!res.ok) {
    throw new CvApiError(res.status, await readError(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const cvApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
};

export async function cvLogin(email: string, password: string): Promise<void> {
  const data = await request<{ accessToken: string }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  setCvSession({ email, accessToken: data.accessToken });
}
