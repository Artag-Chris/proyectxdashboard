"use client";

import { FormEvent, useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { Card } from "@/lib/cv-ui";
import { usePoll } from "@/lib/usePoll";
import type { ProfileRow, ResumeRow, SourceRow } from "@/lib/cv-types";

interface ProfileDetail extends ProfileRow {
  email: string | null;
  summary: string;
  sources: {
    id: string;
    enabled: boolean;
    source: Pick<SourceRow, "id" | "name" | "listUrl" | "kind" | "enabled">;
  }[];
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  EMBEDDING: "bg-blue-100 text-blue-700",
  READY: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

/** Cadencias del cron del perfil, en HORAS (el API sigue guardando minutos). */
const PROFILE_HOUR_OPTIONS = [1, 3, 6, 12, 24, 72];

/** Horas del selector → minutos del API. Vacío = desactivado (null). */
function hoursToMinutes(hours: string): number | null {
  if (!hours.trim()) return null;
  const value = Math.round(Number(hours) * 60);
  if (!Number.isFinite(value)) return null;
  return Math.max(60, value);
}

/** Minutos guardados → horas del selector ("" = desactivado). */
function minutesToHours(minutes: number | null | undefined): string {
  return minutes ? String(Math.max(1, Math.round(minutes / 60))) : "";
}

export default function CvPerfiles() {
  const {
    data: profiles,
    reload,
    error: profilesError,
  } = usePoll<ProfileRow[]>(() => cvApi.get("/profiles"), 15000);
  const [selected, setSelected] = useState<string | null>(null);
  // Borrador de la cadencia (en horas) anclado al perfil que se está editando.
  const [scheduleDraft, setScheduleDraft] = useState<{ profileId: string; hours: string } | null>(
    null,
  );
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [pdf, setPdf] = useState<File | null>(null);
  const [txtName, setTxtName] = useState("");
  const [txt, setTxt] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newHeadline, setNewHeadline] = useState("");
  const [newSummary, setNewSummary] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editHeadline, setEditHeadline] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editPrimary, setEditPrimary] = useState(false);

  const profile = profiles?.find((p) => p.id === selected) ?? profiles?.[0] ?? null;
  const { data: resumes, reload: reloadResumes } = usePoll<ResumeRow[]>(
    () => (profile ? cvApi.get(`/resumes?profileId=${profile.id}`) : Promise.resolve([])),
    5000,
    [profile?.id],
  );
  // Sitios guardados (todos) y selección del perfil actual.
  const { data: allSources } = usePoll<SourceRow[]>(() => cvApi.get("/sources"), 30000);
  const { data: detail, reload: reloadDetail } = usePoll<ProfileDetail | null>(
    () => (profile ? cvApi.get(`/profiles/${profile.id}`) : Promise.resolve(null)),
    30000,
    [profile?.id],
  );
  const selectedIds = new Set((detail?.sources ?? []).map((s) => s.source.id));

  // Horas a mostrar en el selector: manda el borrador mientras sea del perfil
  // actual; al cambiar de perfil se ve el valor guardado de ese perfil.
  const scheduleHours = minutesToHours(profile?.scheduleMinutes);
  const schedule =
    scheduleDraft && scheduleDraft.profileId === profile?.id ? scheduleDraft.hours : scheduleHours;
  // Opciones: las estándar + la guardada, por si quedó una cadencia vieja en
  // minutos que no cae en ninguna hora ofrecida (así el selector no sale vacío).
  const scheduleOptions =
    scheduleHours && !PROFILE_HOUR_OPTIONS.includes(Number(scheduleHours))
      ? [...PROFILE_HOUR_OPTIONS, Number(scheduleHours)].sort((a, b) => a - b)
      : PROFILE_HOUR_OPTIONS;

  async function toggleSite(sourceId: string, checked: boolean) {
    if (!profile) return;
    setBusy(true);
    setMsg("");
    try {
      if (checked) {
        await cvApi.patch(`/profiles/${profile.id}/sources/${sourceId}`, { enabled: true });
        setMsg("Sitio agregado — se están evaluando sus vacantes ya guardadas…");
      } else {
        await cvApi.del(`/profiles/${profile.id}/sources/${sourceId}`);
        setMsg("Sitio quitado del perfil.");
      }
      reloadDetail();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

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
    const minutes = hoursToMinutes(schedule);
    await action(
      minutes
        ? `Cron del perfil: busca cada ${Math.round(minutes / 60)} h.`
        : "Cron del perfil desactivado.",
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

  /**
   * Importa el markdown al perfil ESTRUCTURADO con IA. Es lo que hace que la
   * HV generada salga llena: indexar el texto solo alimenta el match semántico.
   */
  async function importResume() {
    if (!profile || !txt.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await cvApi.post<{
        applied: boolean;
        note: string;
        counts?: Record<string, number>;
      }>(`/profiles/${profile.id}/import-resume`, { content: txt });
      if (!res.applied) {
        setMsg(res.note);
      } else {
        const c = res.counts ?? {};
        setMsg(
          `Perfil actualizado con IA: ${c.experiences ?? 0} experiencia(s), ` +
            `${c.projects ?? 0} proyecto(s), ${c.skills ?? 0} skill(s), ` +
            `${c.education ?? 0} formación, ${c.links ?? 0} enlace(s). ${res.note}`,
        );
      }
      reloadDetail();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  /** Re-evalúa las vacantes ya guardadas contra este perfil (backfill). */
  async function runBackfill() {
    if (!profile) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await cvApi.post<{ candidates: number; enqueued: number; remaining: number }>(
        `/profiles/${profile.id}/backfill`,
      );
      setMsg(
        res.enqueued === 0
          ? "No hay vacantes pendientes de evaluar para este perfil."
          : `Re-evaluando ${res.enqueued} vacante(s)${
              res.remaining > 0 ? ` — quedan ${res.remaining}, volvé a correr` : ""
            }. En unos segundos aparecen en Vacantes.`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  /** Abre el editor con los datos actuales del perfil (sin efectos). */
  function openEdit() {
    if (!profile) return;
    if (!detail) {
      setMsg("Esperá a que cargue el perfil…");
      return;
    }
    setEditName(detail.name);
    setEditEmail(detail.email ?? "");
    setEditHeadline((detail.headline ?? []).join(", "));
    setEditSummary(detail.summary ?? "");
    setEditPrimary(detail.isPrimary);
    setEditOpen(true);
    setMsg("");
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    if (!editName.trim()) {
      setMsg("El nombre no puede quedar vacío.");
      return;
    }
    await action("Perfil actualizado.", () =>
      cvApi.patch(`/profiles/${profile.id}`, {
        name: editName.trim(),
        email: editEmail.trim() || null,
        headline: editHeadline
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean),
        summary: editSummary,
        isPrimary: editPrimary,
      }),
    );
    setEditOpen(false);
    reloadDetail();
  }

  async function deleteProfile() {
    if (!profile) return;
    const c = profile._count;
    const ok = window.confirm(
      `¿Borrar el perfil «${profile.name}»?\n\n` +
        `Se eliminan también: ${c.resumes} HV, ${c.sources} sitio(s) asignado(s) y sus matches y HV generadas.\n` +
        `Las vacantes NO se borran.\n\nEsta acción no se puede deshacer.`,
    );
    if (!ok) return;
    setBusy(true);
    setMsg("");
    try {
      await cvApi.del(`/profiles/${profile.id}`);
      setSelected(null);
      setEditOpen(false);
      setMsg(`Perfil «${profile.name}» borrado.`);
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function createProfile(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMsg("");
    try {
      const created = await cvApi.post<{ id: string }>("/profiles", {
        name,
        email: newEmail.trim() || undefined,
        headline: newHeadline.trim() ? [newHeadline.trim()] : undefined,
        summary: newSummary.trim() || undefined,
      });
      setNewName("");
      setNewEmail("");
      setNewHeadline("");
      setNewSummary("");
      setShowNew(false);
      setSelected(created.id);
      setMsg(`Perfil «${name}» creado — cargale la HV en esta misma pantalla.`);
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (profilesError) {
    return (
      <div>
        <h1 className="text-lg font-bold">Perfiles & Hojas de vida</h1>
        <Card className="mt-3 border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-800">
            No se pudo contactar la API del harness.
          </p>
          <p className="mt-1 break-words text-xs text-amber-700">{profilesError}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
            <li>
              <code>NEXT_PUBLIC_CV_API_URL</code> debe ser <b>https://</b> (Vercel es HTTPS y el
              navegador bloquea http://).
            </li>
            <li>El harness debe compartir el JWT_SECRET de atiende.</li>
          </ul>
          <button
            onClick={reload}
            className="mt-3 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500"
          >
            Reintentar
          </button>
        </Card>
      </div>
    );
  }

  if (!profiles) return <p className="text-zinc-400">Cargando perfiles…</p>;

  const newProfileCard = (
    <Card>
      <h2 className="text-sm font-semibold text-emerald-700">Nuevo perfil</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Un perfil = una persona. Después le cargás su HV y sus sitios.
      </p>
      <form onSubmit={createProfile} className="mt-2 space-y-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre y apellido *"
          className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email (opcional)"
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            value={newHeadline}
            onChange={(e) => setNewHeadline(e.target.value)}
            placeholder="Titular (ej. Backend Engineer)"
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <textarea
          value={newSummary}
          onChange={(e) => setNewSummary(e.target.value)}
          placeholder="Resumen profesional (opcional)"
          rows={3}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="flex gap-2">
          <button
            disabled={!newName.trim() || busy}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Crear perfil
          </button>
          {profiles.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowNew(false);
                setMsg("");
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </Card>
  );

  if (profiles.length === 0) {
    return (
      <div>
        <h1 className="text-lg font-bold">Perfiles & Hojas de vida</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Todavía no hay perfiles. Creá uno para poder cargar la HV de una persona.
        </p>
        <div className="mt-4 max-w-xl">{newProfileCard}</div>
        {msg && <p className="mt-2 max-w-xl text-sm text-emerald-600">{msg}</p>}
      </div>
    );
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
        <button
          onClick={() => {
            setShowNew((v) => !v);
            setMsg("");
          }}
          className="rounded-lg border border-dashed border-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + Nuevo perfil
        </button>
      </div>

      {showNew && <div className="mt-3 max-w-xl">{newProfileCard}</div>}

      {profile && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-emerald-700">
                    Datos del perfil
                    {profile.isPrimary && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        primario ★
                      </span>
                    )}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {detail?.email || "sin email"}
                    {detail?.summary ? ` · ${detail.summary.slice(0, 90)}…` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={openEdit}
                    disabled={busy}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    Editar datos
                  </button>
                  <button
                    onClick={() => void runBackfill()}
                    disabled={busy}
                    className="rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    Re-evaluar vacantes
                  </button>
                  <button
                    onClick={() => void deleteProfile()}
                    disabled={busy || (profiles?.length ?? 0) <= 1}
                    title={
                      (profiles?.length ?? 0) <= 1
                        ? "Es el único perfil: creá otro antes de borrarlo"
                        : "Borrar este perfil y todos sus datos"
                    }
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    Borrar
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                «Re-evaluar» vuelve a puntuar las vacantes ya guardadas de sus sitios contra su HV
                (útil al cargar una HV nueva o al tildar un sitio).
              </p>

              {editOpen && (
                <form onSubmit={saveEdit} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nombre y apellido *"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      value={editHeadline}
                      onChange={(e) => setEditHeadline(e.target.value)}
                      placeholder="Titulares separados por coma"
                      className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    placeholder="Resumen profesional"
                    rows={3}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <label className="flex items-center gap-2 text-xs text-zinc-600">
                    <input
                      type="checkbox"
                      checked={editPrimary}
                      onChange={(e) => setEditPrimary(e.target.checked)}
                    />
                    Es el perfil primario (recibe las vacantes de fuentes que nadie tildó)
                  </label>
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Guardar cambios
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditOpen(false)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </Card>

            <Card>
              <h2 className="text-sm font-semibold text-emerald-700">Cron del perfil</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Cada cuánto se buscan vacantes para <b>{profile.name}</b> en sus sitios.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-zinc-600">
                  Buscar cada
                  <select
                    value={schedule}
                    onChange={(e) =>
                      setScheduleDraft({ profileId: profile.id, hours: e.target.value })
                    }
                    className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Desactivado</option>
                    {scheduleOptions.map((h) => (
                      <option key={h} value={String(h)}>
                        {h} h
                      </option>
                    ))}
                  </select>
                </label>
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
                  ? `Cada ${Math.round(profile.scheduleMinutes / 60)} h · próximo ${profile.nextRunAt ? new Date(profile.nextRunAt).toLocaleString("es-CO") : "—"}`
                  : "Inactivo: igual recibe lo que llegue por la cadencia de sus fuentes, o con «Buscar ahora»."}
                {" · "}
                {profile._count.sources} fuente(s)
              </p>
            </Card>

            <Card>
              <h2 className="text-sm font-semibold text-emerald-700">Sitios que vigila este perfil</h2>
              <p className="mt-1 text-xs text-zinc-500">
                URLs guardadas en la base de datos. Al tildar una, sus vacantes ya guardadas se
                evalúan enseguida contra la HV de este perfil.
              </p>
              <div className="mt-2 flex max-h-56 flex-col gap-1 overflow-auto pr-1">
                {(allSources ?? []).length === 0 && (
                  <p className="text-xs text-zinc-400">Guardá sitios desde «Fuentes».</p>
                )}
                {(allSources ?? []).map((s) => {
                  const checked = selectedIds.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm hover:bg-zinc-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => void toggleSite(s.id, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block truncate text-xs text-zinc-400">{s.listUrl}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
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
                <p className="text-xs text-zinc-400">
                  <b>Indexar texto</b> alimenta el match semántico. <b>Importar al perfil</b> usa la
                  IA para cargar experiencias, proyectos y skills del markdown en el perfil (lo que
                  llena la HV generada).
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={!txt.trim() || busy}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Indexar texto (match)
                  </button>
                  <button
                    type="button"
                    onClick={() => void importResume()}
                    disabled={!txt.trim() || busy}
                    className="rounded-lg border border-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    Importar al perfil (IA)
                  </button>
                </div>
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
