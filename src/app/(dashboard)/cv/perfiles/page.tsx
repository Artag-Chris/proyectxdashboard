"use client";

import { FormEvent, useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { Card } from "@/lib/cv-ui";
import { usePoll } from "@/lib/usePoll";
import type { ProfileRow, ResumeRow } from "@/lib/cv-types";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  EMBEDDING: "bg-blue-100 text-blue-700",
  READY: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export default function CvPerfiles() {
  const { data: profiles, reload } = usePoll<ProfileRow[]>(() => cvApi.get("/profiles"), 15000);
  const [selected, setSelected] = useState<string | null>(null);
  const [schedule, setSchedule] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [pdf, setPdf] = useState<File | null>(null);
  const [txtName, setTxtName] = useState("");
  const [txt, setTxt] = useState("");

  const profile = profiles?.find((p) => p.id === selected) ?? profiles?.[0] ?? null;
  const { data: resumes, reload: reloadResumes } = usePoll<ResumeRow[]>(
    () => (profile ? cvApi.get(`/resumes?profileId=${profile.id}`) : Promise.resolve([])),
    5000,
    [profile?.id],
  );

  async function action(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      setMsg(label);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveSchedule() {
    if (!profile) return;
    const minutes = schedule.trim() ? Math.max(5, Number(schedule)) : null;
    if (minutes !== null && !Number.isFinite(minutes)) {
      setMsg("Ingresá minutos (o vacío para desactivar).");
      return;
    }
    await action(
      minutes ? `Cron del perfil: cada ${minutes} min.` : "Cron del perfil desactivado.",
      () => cvApi.patch(`/profiles/${profile.id}/schedule`, { scheduleMinutes: minutes }),
    );
  }

  async function uploadPdf(e: FormEvent) {
    e.preventDefault();
    if (!profile || !pdf) return;
    const form = new FormData();
    form.append("file", pdf);
    form.append("profileId", profile.id);
    setBusy(true);
    setMsg("");
    try {
      const created = await cvApi.upload<{ id: string }>("/resumes/upload", form);
      setMsg(`PDF recibido — indexando (${created.id.slice(0, 8)}…)`);
      setPdf(null);
      reloadResumes();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function uploadText(e: FormEvent) {
    e.preventDefault();
    if (!profile || !txt.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      await cvApi.post("/resumes/text", {
        profileId: profile.id,
        name: txtName,
        content: txt,
      });
      setMsg("Texto guardado — indexando…");
      setTxt("");
      setTxtName("");
      reloadResumes();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!profiles || profiles.length === 0) {
    return <p className="text-zinc-400">Sin perfiles (corré el seed del harness).</p>;
  }

  return (
    <div>
      <h1 className="text-lg font-bold">Perfiles & Hojas de vida</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Por perfil: HV activa indexada en pgvector, cron propio y fuentes asignadas.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelected(p.id);
              setMsg("");
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              profile?.id === p.id
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {p.name}
            {p.isPrimary && " ★"}
          </button>
        ))}
      </div>

      {profile && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <h2 className="text-sm font-semibold text-emerald-700">Cron del perfil</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={5}
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder={
                    profile.scheduleMinutes ? String(profile.scheduleMinutes) : "minutos (vacío = off)"
                  }
                  className="w-40 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={() => void saveSchedule()}
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Guardar cadencia
                </button>
                <button
                  onClick={() =>
                    void action("Búsqueda despachada.", () => cvApi.post(`/profiles/${profile.id}/run`))
                  }
                  disabled={busy}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  Buscar ahora
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {profile.scheduleMinutes
                  ? `Cada ${profile.scheduleMinutes} min · próximo ${profile.nextRunAt ? new Date(profile.nextRunAt).toLocaleString("es-CO") : "—"}`
                  : "Inactivo: corre cuando sus fuentes vencen o con «Buscar ahora»."}
                {" · "}
                {profile._count.sources} fuente(s)
              </p>
            </Card>

            <Card>
              <h2 className="text-sm font-semibold text-emerald-700">Subir hoja de vida</h2>
              <form onSubmit={uploadPdf} className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-zinc-500 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:text-white"
                />
                <button
                  disabled={!pdf || busy}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Indexar PDF
                </button>
              </form>
              <div className="my-3 border-t border-zinc-100" />
              <form onSubmit={uploadText} className="space-y-2">
                <input
                  value={txtName}
                  onChange={(e) => setTxtName(e.target.value)}
                  placeholder="Nombre (opcional)"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <textarea
                  value={txt}
                  onChange={(e) => setTxt(e.target.value)}
                  placeholder="O pegá tu hoja de vida en texto / markdown…"
                  rows={6}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  disabled={!txt.trim() || busy}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  Indexar texto
                </button>
              </form>
              {msg && <p className="mt-2 text-sm text-emerald-600">{msg}</p>}
            </Card>
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-emerald-700">
              Hojas de vida de {profile.name}
            </h2>
            <div className="mt-2 flex flex-col gap-2">
              {(resumes ?? []).map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg border p-3 ${
                    r.active ? "border-emerald-300 bg-emerald-50" : "border-zinc-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {r.name}
                        {r.active && <span className="ml-2 text-xs text-emerald-600">● activa</span>}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {r.kind} · {r.chunkCount} chunks ·{" "}
                        {new Date(r.createdAt).toLocaleDateString("es-CO")}
                      </div>
                      {r.error && <div className="mt-1 text-xs text-red-600">{r.error}</div>}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[r.status]}`}>
                      {r.status === "EMBEDDING" ? "Indexando…" : r.status}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      {!r.active && r.status === "READY" && (
                        <button
                          onClick={() =>
                            void action("CV activado.", () =>
                              cvApi.post(`/resumes/${r.id}/activate`, { profileId: profile.id }),
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white"
                        >
                          Activar
                        </button>
                      )}
                      <button
                        onClick={() =>
                          void action("CV borrado.", () =>
                            cvApi.del(`/resumes/${r.id}?profileId=${profile.id}`),
                          )
                        }
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-500 hover:bg-red-50"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {resumes && resumes.length === 0 && (
                <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400">
                  Todavía no cargaste una HV para este perfil.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
