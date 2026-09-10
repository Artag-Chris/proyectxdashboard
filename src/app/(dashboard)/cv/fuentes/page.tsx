"use client";

import { FormEvent, useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { usePoll } from "@/lib/usePoll";
import type { SourceRow, SourceTemplate } from "@/lib/cv-types";

/**
 * User-Agent por defecto del editor avanzado. Muchos portales (Cloudflare /
 * WAF) responden 403 a UAs no-navegador, así que se arranca con uno de Chrome.
 */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Cadencias ofrecidas en horas (el API sigue guardando minutos). */
const HOUR_OPTIONS = [1, 3, 6, 12, 24, 72];

interface SelectorForm {
  item: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  postedAt: string;
  applyUrl: string;
  description: string;
  nextPage: string;
  detailDescription: string;
}

const EMPTY_SELECTORS: SelectorForm = {
  item: "",
  title: "",
  company: "",
  location: "",
  salary: "",
  postedAt: "",
  applyUrl: "",
  description: "",
  nextPage: "",
  detailDescription: "",
};

interface LimitsForm {
  fetchDetail: boolean;
  maxPages: string;
  delayMs: string;
  pageParam: string;
  respectRobots: boolean;
  userAgent: string;
}

const DEFAULT_LIMITS: LimitsForm = {
  fetchDetail: false,
  maxPages: "1",
  delayMs: "1000",
  pageParam: "",
  respectRobots: true,
  userAgent: BROWSER_UA,
};

/** Deriva el modo "avanzado" si la receta no vino de una plantilla conocida. */
function selectorsFrom(source: SourceRow): SelectorForm {
  const s = (source.selectors ?? {}) as Record<string, unknown>;
  const detail = (s.detail ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    item: str(s.item),
    title: str(s.title),
    company: str(s.company),
    location: str(s.location),
    salary: str(s.salary),
    postedAt: str(s.postedAt),
    applyUrl: str(s.applyUrl),
    description: str(s.description),
    nextPage: str(s.nextPage),
    detailDescription: str(detail.description),
  };
}

function limitsFrom(source: SourceRow): LimitsForm {
  const l = (source.limits ?? {}) as Record<string, unknown>;
  const s = (source.selectors ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fallback = "") => (v == null ? fallback : String(v));
  return {
    fetchDetail: Boolean(s.fetchDetail),
    maxPages: str(l.maxPages, "1"),
    delayMs: str(l.delayMs, "1000"),
    pageParam: str(l.pageParam),
    respectRobots: l.respectRobots === undefined ? true : Boolean(l.respectRobots),
    userAgent: str(l.userAgent, BROWSER_UA),
  };
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </label>
  );
}

export default function CvFuentes() {
  const { data, error, reload } = usePoll<SourceRow[]>(() => cvApi.get("/sources"), 15000);
  const { data: templates } = usePoll<SourceTemplate[]>(
    () => cvApi.get("/sources/templates"),
    60000,
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openRecipe, setOpenRecipe] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [listUrl, setListUrl] = useState("");
  const [hours, setHours] = useState("24");

  const [sel, setSel] = useState<SelectorForm>(EMPTY_SELECTORS);
  const [lim, setLim] = useState<LimitsForm>(DEFAULT_LIMITS);

  const setSelector = (key: keyof SelectorForm) => (v: string) =>
    setSel((prev) => ({ ...prev, [key]: v }));
  const setLimit = (key: keyof LimitsForm) => (v: string | boolean) =>
    setLim((prev) => ({ ...prev, [key]: v }));

  function resetForm() {
    setEditingId(null);
    setAdvanced(false);
    setName("");
    setTemplateId("");
    setListUrl("");
    setHours("24");
    setSel(EMPTY_SELECTORS);
    setLim(DEFAULT_LIMITS);
  }

  function openCreate() {
    resetForm();
    setMsg("");
    setShowForm(true);
  }

  function openEdit(s: SourceRow) {
    setEditingId(s.id);
    setName(s.name);
    setListUrl(s.listUrl);
    setHours(String(Math.max(1, Math.round(s.intervalMinutes / 60))));
    setTemplateId("");
    // Una fuente existente se edita con su receta tal cual está guardada.
    setAdvanced(true);
    setSel(selectorsFrom(s));
    setLim(limitsFrom(s));
    setMsg("");
    setShowForm(true);
  }

  async function toggle(s: SourceRow) {
    await cvApi.patch(`/sources/${s.id}`, { enabled: !s.enabled });
    reload();
  }

  async function run(s: SourceRow) {
    setBusyId(s.id);
    try {
      const res = await cvApi.post<{ requestId: string }>(`/sources/${s.id}/run`);
      setMsg(`${s.name}: despachado (${res.requestId.slice(0, 8)}…)`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  function recipePayload(): Record<string, unknown> {
    return {
      item: sel.item.trim(),
      title: sel.title.trim(),
      ...(sel.company.trim() && { company: sel.company.trim() }),
      ...(sel.location.trim() && { location: sel.location.trim() }),
      ...(sel.salary.trim() && { salary: sel.salary.trim() }),
      ...(sel.postedAt.trim() && { postedAt: sel.postedAt.trim() }),
      ...(sel.applyUrl.trim() && { applyUrl: sel.applyUrl.trim() }),
      ...(sel.description.trim() && { description: sel.description.trim() }),
      ...(sel.nextPage.trim() && { nextPage: sel.nextPage.trim() }),
      fetchDetail: lim.fetchDetail,
      ...(lim.fetchDetail &&
        sel.detailDescription.trim() && {
          detail: { description: sel.detailDescription.trim() },
        }),
    };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedUrl = listUrl.trim();
    if (!trimmedName || !trimmedUrl) return;

    if (advanced && (!sel.item.trim() || !sel.title.trim())) {
      setMsg("Receta: los selectores «vacante» y «título» son obligatorios.");
      return;
    }
    if (!advanced && !templateId) {
      setMsg("Elegí una plantilla, o pasá al editor avanzado.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: trimmedName,
      listUrl: trimmedUrl,
      intervalMinutes: Math.max(5, Math.round((Number(hours) || 24) * 60)),
    };
    if (advanced) {
      payload.selectors = recipePayload();
      payload.limits = {
        maxPages: Math.max(1, Number(lim.maxPages) || 1),
        delayMs: Math.max(0, Number(lim.delayMs) || 0),
        timeoutMs: 20000,
        userAgent: lim.userAgent.trim() || BROWSER_UA,
        respectRobots: lim.respectRobots,
        ...(lim.pageParam.trim() && { pageParam: lim.pageParam.trim() }),
      };
    } else {
      payload.templateId = templateId;
    }

    try {
      if (editingId) {
        await cvApi.patch(`/sources/${editingId}`, payload);
        setMsg(`Fuente «${trimmedName}» actualizada. Corré «Correr ahora» para probarla.`);
      } else {
        const created = await cvApi.post<SourceRow>("/sources", payload);
        setMsg(`Sitio guardado: ${created.name}. Asignalo a un perfil desde «Perfiles & CV».`);
      }
      resetForm();
      setShowForm(false);
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Fuentes de vacantes</h1>
          <span className="text-xs text-zinc-500">
            Plantilla del portal o receta CSS propia (editor avanzado)
          </span>
        </div>
        <button
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              resetForm();
            } else {
              openCreate();
            }
          }}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {showForm ? "Cerrar" : "+ Nueva fuente"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="mb-4 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <p className="text-sm font-semibold text-emerald-700">
            {editingId ? "Editar fuente" : "Nueva fuente"}
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre (ej. Computrabajo React)"
              required
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              Revisar cada
              <select
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
              >
                {HOUR_OPTIONS.map((h) => (
                  <option key={h} value={String(h)}>
                    {h} h
                  </option>
                ))}
              </select>
            </label>
          </div>

          <input
            value={listUrl}
            onChange={(e) => setListUrl(e.target.value)}
            placeholder="URL del listado que scrapea el cron"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-3">
            <div className="flex rounded-lg border border-zinc-300 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAdvanced(false)}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  !advanced ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Plantilla del portal
              </button>
              <button
                type="button"
                onClick={() => setAdvanced(true)}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  advanced ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Editor avanzado (CSS)
              </button>
            </div>
            <span className="text-xs text-zinc-400">
              {advanced
                ? "Pegá los selectores CSS del listado. Usalo con sitios que permitan scraping."
                : "Portales ya soportados: elegí plantilla y pegá la URL."}
            </span>
          </div>

          {!advanced && (
            <div className="grid grid-cols-1 gap-2">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                required
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Plantilla…</option>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {templates?.find((t) => t.id === templateId) && (
                <p className="text-xs text-zinc-400">
                  {templates.find((t) => t.id === templateId)?.hint}
                </p>
              )}
            </div>
          )}

          {advanced && (
            <div className="space-y-3 rounded-lg bg-zinc-50 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Selector de cada vacante"
                  value={sel.item}
                  onChange={setSelector("item")}
                  placeholder="div.result-item"
                  required
                />
                <Field
                  label="Título"
                  value={sel.title}
                  onChange={setSelector("title")}
                  placeholder="a.offer-title"
                  required
                />
                <Field
                  label="URL de la oferta"
                  value={sel.applyUrl}
                  onChange={setSelector("applyUrl")}
                  placeholder="a.offer-title"
                />
                <Field
                  label="Empresa"
                  value={sel.company}
                  onChange={setSelector("company")}
                  placeholder="span.company"
                />
                <Field
                  label="Ubicación"
                  value={sel.location}
                  onChange={setSelector("location")}
                  placeholder="span.city"
                />
                <Field
                  label="Salario"
                  value={sel.salary}
                  onChange={setSelector("salary")}
                  placeholder="div.salary"
                />
                <Field
                  label="Fecha de publicación"
                  value={sel.postedAt}
                  onChange={setSelector("postedAt")}
                  placeholder="span.date"
                />
                <Field
                  label="Descripción (en el listado)"
                  value={sel.description}
                  onChange={setSelector("description")}
                  placeholder="li.item-description"
                />
                <Field
                  label="Link «siguiente»"
                  value={sel.nextPage}
                  onChange={setSelector("nextPage")}
                  placeholder='a[rel="next"]'
                />
              </div>

              <p className="text-xs text-zinc-500">
                Si la descripción ya viene en la tarjeta del listado, ponela arriba y dejá
                desmarcado «bajar cada detalle» (evita un request extra por vacante).
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Máx. páginas"
                  value={lim.maxPages}
                  onChange={setLimit("maxPages")}
                  placeholder="1"
                />
                <Field
                  label="Pausa entre requests (ms)"
                  value={lim.delayMs}
                  onChange={setLimit("delayMs")}
                  placeholder="1000"
                />
                <Field
                  label="Parámetro de paginación"
                  value={lim.pageParam}
                  onChange={setLimit("pageParam")}
                  placeholder="page"
                />
                <Field
                  label="User-Agent"
                  value={lim.userAgent}
                  onChange={setLimit("userAgent")}
                />
              </div>

              <p className="text-xs text-zinc-500">
                «Parámetro de paginación» (ej. <code>page</code>) sirve cuando el listado no
                trae un link «siguiente» en el HTML (la paginación la dibuja JavaScript).
                Dejalo vacío si usás el link «siguiente».
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={lim.fetchDetail}
                    onChange={(e) => setLimit("fetchDetail")(e.target.checked)}
                  />
                  La descripción no está en el listado: bajar cada detalle
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={lim.respectRobots}
                    onChange={(e) => setLimit("respectRobots")(e.target.checked)}
                  />
                  Respetar robots.txt
                </label>
              </div>

              {lim.fetchDetail && (
                <Field
                  label="Selector de la descripción (dentro del detalle)"
                  value={sel.detailDescription}
                  onChange={setSelector("detailDescription")}
                  placeholder="div[div-link='oferta']"
                />
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
              {editingId ? "Guardar cambios" : "Guardar sitio"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setMsg("");
                }}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mb-2 text-sm text-emerald-600">{msg}</p>}

      <div className="flex flex-col gap-2">
        {(data ?? []).map((s) => {
          const lastRun = s.runs?.[0];
          const recipeOpen = openRecipe === s.id;
          return (
            <div
              key={s.id}
              className={`flex flex-wrap items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm ${
                editingId === s.id ? "border-emerald-400" : "border-zinc-200"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${s.enabled ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="font-medium">{s.name}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-zinc-500">{s.listUrl}</div>
                <div className="mt-1 text-xs text-zinc-400">
                  cada {Math.round(s.intervalMinutes / 60)} h · {s._count?.vacancies ?? 0} vacantes
                  {s.lastRunAt ? ` · última ${new Date(s.lastRunAt).toLocaleString("es-CO")}` : ""}
                </div>
                {lastRun && (
                  <div className="mt-1 text-xs">
                    {lastRun.status === "FAILED" ? (
                      <span className="text-red-600">
                        ✕ Falló: {lastRun.error ?? "error desconocido"}
                      </span>
                    ) : lastRun.status === "RUNNING" ? (
                      <span className="text-zinc-500">⟳ Corriendo…</span>
                    ) : (
                      <span className="text-emerald-600">
                        ✓ {lastRun.itemsFound} encontradas · {lastRun.itemsNew} nuevas
                      </span>
                    )}
                  </div>
                )}
                {recipeOpen && (
                  <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-zinc-900 p-3 text-[11px] leading-tight text-zinc-100">
                    {JSON.stringify({ selectors: s.selectors, limits: s.limits }, null, 2)}
                  </pre>
                )}
              </div>
              <button
                onClick={() => openEdit(s)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Editar
              </button>
              <button
                onClick={() => setOpenRecipe(recipeOpen ? null : s.id)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50"
              >
                {recipeOpen ? "Ocultar receta" : "Ver receta"}
              </button>
              <button
                onClick={() => void toggle(s)}
                disabled={busyId === s.id}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  s.enabled
                    ? "border border-zinc-300 text-zinc-500 hover:bg-zinc-50"
                    : "bg-emerald-600 text-white hover:bg-emerald-500"
                }`}
              >
                {s.enabled ? "Deshabilitar" : "Habilitar"}
              </button>
              <button
                onClick={() => void run(s)}
                disabled={busyId === s.id || !s.enabled}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-40"
              >
                {busyId === s.id ? "…" : "Correr ahora"}
              </button>
            </div>
          );
        })}
        {data && data.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
            No hay fuentes. Creá una con «+ Nueva fuente».
          </p>
        )}
      </div>
    </div>
  );
}
