// Cliente HTTP para la API de CV-Harness. Sin login propio: reutiliza la
// sesión de atiende (mismo JWT_SECRET en el server) leyendo 'atiende_auth'.
// Si el token venció, renueva igual que el resto del dashboard; si el harness
// rechaza el token (p.ej. JWT_SECRET no compartido) muestra un error DENTRO de
// la pestaña CV y no saca al usuario del dashboard.
const API_BASE = process.env.NEXT_PUBLIC_CV_API_URL || "http://localhost:3100/api";
const ATIENDE_API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const ATIENDE_STORAGE_KEY = "atiende_auth";

export class CvApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "CvApiError";
  }
}

interface AtiendeAuthState {
  user?: { email?: string };
  accessToken: string;
  refreshToken?: string;
}

function readAtiende(): AtiendeAuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ATIENDE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AtiendeAuthState;
    return parsed?.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

export function getCvSession(): { email: string; accessToken: string } {
  const state = readAtiende();
  if (!state) return { email: "", accessToken: "" };
  return { email: state.user?.email ?? "", accessToken: state.accessToken };
}

/** Renueva el access token de atiende con su refresh token (token rotation). */
async function tryRefreshAtiende(): Promise<boolean> {
  const state = readAtiende();
  if (!state?.refreshToken) return false;
  try {
    const res = await fetch(`${ATIENDE_API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken?: string;
    };
    const current = readAtiende();
    if (!current) return false;
    localStorage.setItem(
      ATIENDE_STORAGE_KEY,
      JSON.stringify({
        ...current,
        accessToken: data.accessToken,
        ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
      }),
    );
    return true;
  } catch {
    return false;
  }
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

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const isForm = init.body instanceof FormData;
  const headers: Record<string, string> = isForm
    ? {}
    : { "Content-Type": "application/json" };
  const session = getCvSession();
  if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401 && !retried) {
    if (await tryRefreshAtiende()) {
      return request<T>(path, init, true);
    }
    // Ya sin token de atiende: sí corresponde volver al login del dashboard.
    if (!readAtiende()) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
      throw new CvApiError(401, "Sesión de atiende expirada");
    }
    // Token existe pero el harness lo rechazó → error visible en la pestaña.
    throw new CvApiError(
      401,
      "CV Harness rechazó la sesión. Revisá que el harness comparta el JWT_SECRET de atiende.",
    );
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
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData) =>
    request<T>(path, { method: "POST", body: form }),
};
