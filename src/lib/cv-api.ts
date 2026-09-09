// Cliente HTTP para la API de CV-Harness. Sin login propio: reutiliza la
// sesión de atiende (mismo JWT_SECRET en el server) leyendo 'atiende_auth'.
const API_BASE = process.env.NEXT_PUBLIC_CV_API_URL || "http://localhost:3100/api";
const ATIENDE_STORAGE_KEY = "atiende_auth";

export class CvApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "CvApiError";
  }
}

interface AtiendeSession {
  user?: { email?: string };
  accessToken: string;
}

export function getCvSession(): { email: string; accessToken: string } {
  if (typeof window === "undefined") return { email: "", accessToken: "" };
  try {
    const raw = localStorage.getItem(ATIENDE_STORAGE_KEY);
    if (!raw) return { email: "", accessToken: "" };
    const parsed = JSON.parse(raw) as AtiendeSession;
    if (!parsed.accessToken) return { email: "", accessToken: "" };
    return { email: parsed.user?.email ?? "", accessToken: parsed.accessToken };
  } catch {
    return { email: "", accessToken: "" };
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const headers: Record<string, string> = isForm
    ? {}
    : { "Content-Type": "application/json" };
  const session = getCvSession();
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (res.status === 401) {
    // El token de atiende venció: la sesión del dashboard lo renueva en sus
    // propias llamadas; acá forzamos recarga para que el flujo siga normal.
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new CvApiError(401, "Sesión de atiende expirada");
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
