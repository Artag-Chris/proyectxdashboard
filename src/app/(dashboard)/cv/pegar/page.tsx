"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ResumeExportPanel } from "@/components/cv/ResumeExportPanel";
import { cvApi } from "@/lib/cv-api";
import { Card, Score, StatusBadge } from "@/lib/cv-ui";
import type { ManualIntakeResponse, ProfileRow, VacancyDetail } from "@/lib/cv-types";

/** Cada cuánto se consulta el avance del pipeline mientras no haya HV. */
const POLL_MS = 4000;

/**
 * Margen antes de concluir que el match no alcanzó el umbral: entre MATCH y la
 * HV hay un job en cola, así que durante unos segundos "sin HV" todavía puede
 * significar "generándose".
 */
const GRACE_MS = 25000;

const INPUT =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-zinc-600">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export default function CvPegarOferta() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profileId, setProfileId] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const [vacancyId, setVacancyId] = useState<string | null>(null);
  const [vac, setVac] = useState<VacancyDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // Marca de tiempo del primer match visto sin HV (para el margen de gracia).
  const [matchSeenAt, setMatchSeenAt] = useState<number | null>(null);
  // Reloj que avanza con cada consulta: permite decidir el margen sin leer la
  // hora durante el render (que sería impuro).
  const [now, setNow] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await cvApi.get<ProfileRow[]>("/profiles");
        setProfiles(rows);
        const primary = rows.find((p) => p.isPrimary) ?? rows[0];
        if (primary) setProfileId((current) => current || primary.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  // Seguimiento del pipeline: consulta hasta que aparezca la HV (o el perfil ya
  // la haya aplicado/ignorado). Se detiene al llegar para no remontar el panel.
  useEffect(() => {
    if (!vacancyId || !profileId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const v = await cvApi.get<VacancyDetail>(
          `/vacancies/${vacancyId}?profileId=${profileId}`,
        );
        if (stopped) return;
        setVac(v);
        setNow(Date.now());
        if (v.match && !v.resume) {
          // Setter funcional: no depende del valor previo en el cierre.
          setMatchSeenAt((prev) => prev ?? Date.now());
        }
        const done = !!v.resume || v.status === "APPLIED" || v.status === "IGNORED";
        if (!done) timer = setTimeout(tick, POLL_MS);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : String(e));
      }
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [vacancyId, profileId]);

  /** Refresco puntual (tras guardar en el panel), sin reiniciar el seguimiento. */
  async function reload() {
    if (!vacancyId || !profileId) return;
    try {
      const v = await cvApi.get<VacancyDetail>(`/vacancies/${vacancyId}?profileId=${profileId}`);
      setVac(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submit() {
    if (text.trim().length < 80) {
      setError("Pegá el texto completo de la oferta (al menos 80 caracteres).");
      return;
    }
    setBusy(true);
    setError("");
    setMsg("");
    setVac(null);
    setMatchSeenAt(null);
    try {
      const res = await cvApi.post<ManualIntakeResponse>("/vacancies/from-text", {
        text,
        profileId: profileId || undefined,
        title: title || undefined,
        company: company || undefined,
        url: url || undefined,
      });
      setVacancyId(res.vacancyId);
      setMsg(
        res.reused
          ? "Ya tenías esta oferta cargada: seguimos desde su análisis existente."
          : "Oferta cargada. Analizando requisitos y encaje…",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function forceResume() {
    if (!vacancyId || !profileId) return;
    setBusy(true);
    setError("");
    try {
      await cvApi.post(`/vacancies/${vacancyId}/generate-resume?profileId=${profileId}`);
      setMsg("Generando la hoja de vida a pedido…");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const stalled =
    !!vac &&
    !vac.resume &&
    !!vac.match &&
    matchSeenAt !== null &&
    now - matchSeenAt > GRACE_MS;

  const phase = !vacancyId
    ? null
    : !vac
      ? "Enviando la oferta…"
      : vac.resume
        ? "Hoja de vida lista"
        : vac.status === "RAW"
          ? "Analizando la oferta y extrayendo requisitos…"
          : vac.status === "NORMALIZED"
            ? "Evaluando el encaje con el perfil…"
            : "Generando la hoja de vida…";

  return (
    <div className="max-w-5xl">
      <h1 className="text-lg font-bold">Pegar oferta</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Para ofertas que no se pueden scrapear (LinkedIn, portales con login…). Pegá el texto y se
        genera la hoja de vida personalizada y su carta, con el mismo motor de la pestaña Vacantes.
      </p>

      <Card className="mt-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Perfil a postular
            </span>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className={INPUT}
            >
              {profiles.length === 0 && <option value="">Sin perfiles</option>}
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.isPrimary ? " ★" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100"
          >
            {showOptional ? "Ocultar datos opcionales" : "Datos opcionales (puesto, empresa, URL)"}
          </button>
        </div>

        {showOptional && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              className={INPUT}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Puesto (ej: Junior Fullstack Developer)"
            />
            <input
              className={INPUT}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Empresa (ej: BairesDev)"
            />
            <input
              className={INPUT}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL de la oferta"
            />
          </div>
        )}

        <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Texto de la oferta
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          placeholder={"Pegá acá la descripción completa.\n\nAbout the job\nAt BairesDev…"}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !profileId || text.trim().length < 80}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Generar hoja de vida
          </button>
          <span className="text-xs text-zinc-400">{text.trim().length} caracteres</span>
          {msg && <span className="text-xs text-emerald-700">{msg}</span>}
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {profiles.length === 0 && (
          <p className="mt-2 text-xs text-amber-600">
            Necesitás al menos un perfil: creá uno en «Perfiles & CV».
          </p>
        )}
      </Card>

      {vacancyId && (
        <div className="mt-4 space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-semibold text-emerald-700">{phase}</h2>
                {vac && <StatusBadge status={vac.status} />}
                {vac && <Score score={vac.matchScore} />}
              </div>
              <Link
                href={`/cv/vacantes/${vacancyId}?profileId=${profileId}`}
                className="text-xs text-zinc-500 underline hover:text-zinc-700"
              >
                Ver en Vacantes →
              </Link>
            </div>
            {!vac?.resume && (
              <p className="mt-2 text-xs text-zinc-400">
                Esto corre en segundo plano. Podés cerrar la pestaña: la HV queda guardada.
              </p>
            )}
          </Card>

          {stalled && vac?.match && (
            <Card>
              <h2 className="text-sm font-semibold text-amber-700">
                El match no superó el umbral ({vac.match.score}/100 · {vac.match.verdict})
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Por eso no se generó la hoja automáticamente. Si querés postular igual, generala a
                pedido.
              </p>
              <ListBlock title="Razones" items={vac.match.reasons} />
              <ListBlock title="Brechas" items={vac.match.gaps} />
              <button
                type="button"
                onClick={() => void forceResume()}
                disabled={busy}
                className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Generar la hoja de vida igualmente
              </button>
            </Card>
          )}

          {vac?.resume && (
            <ResumeExportPanel
              key={vac.resume.id}
              draftId={vac.resume.id}
              profileId={vac.resume.profileId}
              content={vac.resume.content}
              vacancyTitle={vac.title}
              company={vac.company}
              onChanged={reload}
            />
          )}
        </div>
      )}
    </div>
  );
}
