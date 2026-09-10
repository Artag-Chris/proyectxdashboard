"use client";

import { FormEvent, useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { usePoll } from "@/lib/usePoll";
import type { SourceRow, SourceTemplate } from "@/lib/cv-types";

export default function CvFuentes() {
  const { data, error, reload } = usePoll<SourceRow[]>(() => cvApi.get("/sources"), 15000);
  const { data: templates } = usePoll<SourceTemplate[]>(
    () => cvApi.get("/sources/templates"),
    60000,
  );

  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [listUrl, setListUrl] = useState("");

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

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const created = await cvApi.post<SourceRow>("/sources", {
        name: name.trim(),
        templateId,
        listUrl: listUrl.trim(),
        intervalMinutes: 1440,
      });
      setMsg(`Sitio guardado: ${created.name}. Asignalo a un perfil desde «Perfiles & CV».`);
      setName("");
      setListUrl("");
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
          <span className="text-xs text-zinc-500">Plantilla + URL del listado por perfil</span>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {showForm ? "Cerrar" : "+ Nueva fuente"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={create}
          className="mb-4 grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (ej. Computrabajo React)"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
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
          <input
            value={listUrl}
            onChange={(e) => setListUrl(e.target.value)}
            placeholder="URL del listado que scrapea el cron"
            required
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:col-span-2"
          />
          {templates?.find((t) => t.id === templateId) && (
            <p className="text-xs text-zinc-400 sm:col-span-2">
              {templates.find((t) => t.id === templateId)?.hint}
            </p>
          )}
          <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 sm:col-span-2">
            Guardar sitio
          </button>
        </form>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="mb-2 text-sm text-emerald-600">{msg}</p>}

      <div className="flex flex-col gap-2">
        {(data ?? []).map((s) => {
          const lastRun = s.runs?.[0];
          return (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${s.enabled ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="font-medium">{s.name}</span>
              </div>
              <div className="mt-0.5 truncate text-xs text-zinc-500">{s.listUrl}</div>
              <div className="mt-1 text-xs text-zinc-400">
                cada {s.intervalMinutes} min · {s._count?.vacancies ?? 0} vacantes
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
            </div>
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
