// Cliente HTTP para la API de Doc-Harness. Sin login propio: reutiliza la sesión
// de atiende (mismo JWT_SECRET en el harness) leyendo 'atiende_auth'. Mismo patrón
// que cv-api.ts / social-api.ts.
const API_BASE = process.env.NEXT_PUBLIC_DOCS_API_URL || "http://localhost:3300/api";
const ATIENDE_API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const ATIENDE_STORAGE_KEY = "atiende_auth";

export class DocsApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "DocsApiError";
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

export function getDocsSession(): { email: string; accessToken: string } {
  const state = readAtiende();
  if (!state) return { email: "", accessToken: "" };
  return { email: state.user?.email ?? "", accessToken: state.accessToken };
}

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
    const data = (await res.json()) as { accessToken: string; refreshToken?: string };
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
    if (Array.isArray(body?.issues)) {
      return body.issues.map((i: { field: string; message: string }) => `${i.field}: ${i.message}`).join(" · ");
    }
  } catch {
    /* noop */
  }
  return res.statusText;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const session = getDocsSession();
  return {
    ...extra,
    ...(session.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
  };
}

async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: authHeaders({ "Content-Type": "application/json", ...(init.headers as Record<string, string>) }),
  });

  if (res.status === 401 && !retried) {
    if (await tryRefreshAtiende()) return request<T>(path, init, true);
    if (!readAtiende()) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
      throw new DocsApiError(401, "Sesión de atiende expirada");
    }
    throw new DocsApiError(
      401,
      "Doc Harness rechazó la sesión. Revisá que el harness comparta el JWT_SECRET de atiende.",
    );
  }
  if (!res.ok) throw new DocsApiError(res.status, await readError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Descarga un binario autenticado (los artefactos y la vista previa). */
async function fetchBlob(path: string, retried = false): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (res.status === 401 && !retried) {
    if (await tryRefreshAtiende()) return fetchBlob(path, true);
    throw new DocsApiError(401, "Doc Harness rechazó la sesión.");
  }
  if (!res.ok) throw new DocsApiError(res.status, await readError(res));
  return res.blob();
}

export const docsApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  /** Sube un archivo (multipart). El navegador pone el Content-Type con boundary. */
  async upload<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) throw new DocsApiError(res.status, await readError(res));
    return res.json() as Promise<T>;
  },

  /** Trae un binario y devuelve una URL de objeto para descargar o previsualizar. */
  async blobUrl(path: string): Promise<string> {
    const blob = await fetchBlob(path);
    return URL.createObjectURL(blob);
  },

  /** Dispara la descarga de un artefacto. */
  async download(path: string, filename: string): Promise<void> {
    const blob = await fetchBlob(path);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
