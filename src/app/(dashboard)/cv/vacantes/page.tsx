"use client";

import Link from "next/link";
import { useState } from "react";
import { cvApi } from "@/lib/cv-api";
import {
  ModalityChips,
  MODALITY_OPTIONS,
  Score,
  SENIORITY_OPTIONS,
  seniorityLabel,
  StatusBadge,
} from "@/lib/cv-ui";
import { usePoll } from "@/lib/usePoll";
import type { ProfileRow, VacancyRow } from "@/lib/cv-types";

interface ListResponse {
  rows: VacancyRow[];
  total: number;
  /** Total sin aplicar el filtro de minScore (para avisar cuántas hay ocultas). */
  unfilteredTotal?: number;
}

const STATUSES = ["ALL", "RAW", "NORMALIZED", "MATCHED", "RESUME_READY", "APPLIED", "IGNORED"];

/** Umbral por defecto: debajo de esto la vacante no se muestra salvo que pidas ver todas. */
const DEFAULT_MIN_SCORE = 70;

export default function CvVacantes() {
  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");
  const [profileId, setProfileId] = useState("");
  const [modality, setModality] = useState("");
  const [seniority, setSeniority] = useState("");
  const [location, setLocation] = useState("");
  const [onlyGoodMatch, setOnlyGoodMatch] = useState(true);
  const [minScore, setMinScore] = useState(String(DEFAULT_MIN_SCORE));
  // Los duplicados se ocultan por defecto (se marcan, no se borran).
  const [showDuplicates, setShowDuplicates] = useState(false);

  const { data: profiles } = usePoll<ProfileRow[]>(() => cvApi.get("/profiles"), 30000);

  const isPreMatchStatus = status === "RAW" || status === "NORMALIZED";
  const effectiveMin =
    onlyGoodMatch && !isPreMatchStatus
      ? Math.max(0, Number(minScore) || DEFAULT_MIN_SCORE)
      : null;
  const params = new URLSearchParams({ status, limit: "100" });
  if (q) params.set("q", q);
  if (profileId) params.set("profileId", profileId);
  if (modality) params.set("modality", modality);
  if (seniority) params.set("seniority", seniority);
  if (location.trim()) params.set("location", location.trim());
  if (effectiveMin !== null) params.set("minScore", String(effectiveMin));
  if (showDuplicates) params.set("duplicates", "all");

  const { data, error, reload } = usePoll<ListResponse>(
    () => cvApi.get(`/vacancies?${params.toString()}`),
    15000,
    [status, q, profileId, modality, seniority, location, onlyGoodMatch, minScore, showDuplicates],
  );

  const selectedProfile = (profiles ?? []).find((p) => p.id === profileId) ?? null;
  const hiddenByScore =
    effectiveMin !== null && data && typeof data.unfilteredTotal === "number"
      ? Math.max(0, data.unfilteredTotal - data.total)
      : 0;

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <h1 className="col-span-2 text-lg font-bold sm:col-auto sm:mr-2">Vacantes</h1>
        <select
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-base sm:w-auto sm:py-1.5 sm:text-sm"
          title="Ver solo las vacantes evaluadas por un perfil"
        >
          <option value="">Todos los perfiles</option>
          {(profiles ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isPrimary ? " ★" : ""}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-base sm:w-auto sm:py-1.5 sm:text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "Todas" : s}
            </option>
          ))}
        </select>
        <select
          value={modality}
          onChange={(e) => setModality(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-base sm:w-auto sm:py-1.5 sm:text-sm"
          title="Modalidad de la vacante: remota, híbrida o presencial"
        >
          <option value="">Toda modalidad</option>
          {MODALITY_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-base sm:w-auto sm:py-1.5 sm:text-sm"
          title="Seniority pedido por la vacante"
        >
          <option value="">Todo seniority</option>
          {SENIORITY_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && reload()}
          placeholder="Ubicación…"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-36 sm:py-1.5 sm:text-sm"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && reload()}
          placeholder="Buscar…"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-48 sm:py-1.5 sm:text-sm"
        />
        <span className="col-span-2 text-xs text-zinc-500 sm:col-auto">{data?.total ?? 0} resultados</span>
      </div>

      {selectedProfile && (
        <p className="mb-2 text-xs text-emerald-700">
          Viendo solo las vacantes evaluadas para <b>{selectedProfile.name}</b>, con su score
          propio.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={onlyGoodMatch}
            onChange={(e) => setOnlyGoodMatch(e.target.checked)}
          />
          Solo buen match
        </label>
        {onlyGoodMatch && (
          <label className="flex items-center gap-1 text-sm text-zinc-600">
            ≥
            <input
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              inputMode="numeric"
              className="w-16 rounded-lg border border-zinc-300 px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:w-14 sm:py-1 sm:text-sm"
            />
            %
          </label>
        )}
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={showDuplicates}
            onChange={(e) => setShowDuplicates(e.target.checked)}
          />
          Ver duplicados
        </label>
        <button
          type="button"
          onClick={() => setOnlyGoodMatch((prev) => !prev)}
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
            onlyGoodMatch
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-zinc-300 bg-zinc-900 text-white hover:bg-zinc-800"
          }`}
        >
          {onlyGoodMatch
            ? hiddenByScore > 0
              ? `Ver todo sin filtro (+${hiddenByScore} ocultas)`
              : "Ver todo lo scrapeado (sin filtro)"
            : "Viendo todo sin filtro · volver a buen match"}
        </button>
        <span className="text-xs text-zinc-400">
          {isPreMatchStatus
            ? `En estado ${status} no se aplica el filtro de score.`
            : onlyGoodMatch
              ? selectedProfile
                ? `Se ocultan las vacantes que no llegan al ${effectiveMin}% para ${selectedProfile.name}.`
                : "Se ocultan las vacantes sin match suficiente (y las aún no analizadas)."
              : "Mostrando todo lo scrapeado, incluidas las ofertas básicas sin IA."}
        </span>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        {(data?.rows ?? []).map((v) => (
          <div
            key={v.id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-3 shadow-sm hover:border-emerald-400 sm:px-4"
          >
            <Link
              href={`/cv/vacantes/${v.id}${profileId ? `?profileId=${profileId}` : ""}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{v.title}</div>
                <div className="truncate text-sm text-zinc-500">
                  {[v.company, v.location, v.salary].filter(Boolean).join(" · ") || "—"}
                  <span className="ml-2 text-xs text-zinc-400">{v.source.name}</span>
                  {v.isManual && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      Manual
                    </span>
                  )}
                  {(v.isFallback || v.status === "RAW") && (
                    <span
                      title="Procesada con datos básicos del scraping (sin análisis de IA)"
                      className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      Sin IA
                    </span>
                  )}
                  {v.isDuplicate && (
                    <span
                      title={
                        v.duplicateOf
                          ? `Duplicado de: ${v.duplicateOf.title}`
                          : "Marcado como duplicado de otro aviso"
                      }
                      className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600"
                    >
                      Duplicado
                    </span>
                  )}
                </div>
                {(v.modalityTypes.length > 0 || seniorityLabel(v.seniorityLevel)) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <ModalityChips types={v.modalityTypes} />
                    {seniorityLabel(v.seniorityLevel) && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                        {seniorityLabel(v.seniorityLevel)}
                      </span>
                    )}
                  </div>
                )}
                {!selectedProfile && v.profiles.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {v.profiles.map((p) => (
                      <span
                        key={p.profileId}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"
                      >
                        {p.profileName}
                        {p.score !== null ? ` ${p.score}%` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <StatusBadge status={v.status} />
              <div className="w-10 shrink-0 text-right">
                <Score score={v.matchScore} />
              </div>
            </Link>
            {/*
              Aplicar sin entrar a la ficha. La URL la trae la fuente: en los
              portales es el aviso real (el API lo absolutiza: los listados dan
              el href relativo) y en los agregadores su enlace de redirección
              (se resuelve en el navegador, no en el servidor).
            */}
            {/*
              Link al aviso canónico: va FUERA del Link de la fila para no anidar
              anclas (mismo motivo por el que «Aplicar ↗» vive acá).
            */}
            {v.isDuplicate && v.duplicateOf && (
              <Link
                href={`/cv/vacantes/${v.duplicateOf.id}`}
                title={`Ver el aviso canónico: ${v.duplicateOf.title}`}
                className="shrink-0 rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
              >
                Ver original
              </Link>
            )}
            {(v.applyUrl ?? v.url) && (
              <a
                href={v.applyUrl ?? v.url}
                target="_blank"
                rel="noreferrer"
                title={v.applyUrl ?? v.url}
                className="w-full shrink-0 rounded-lg border border-emerald-300 px-3 py-2 text-center text-xs font-semibold text-emerald-700 hover:bg-emerald-50 sm:w-auto"
              >
                Aplicar ↗
              </a>
            )}
          </div>
        ))}
        {data && data.rows.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            <p>
              {onlyGoodMatch && !isPreMatchStatus
                ? hiddenByScore > 0
                  ? `Ninguna vacante llega al ${effectiveMin}% de match${
                      selectedProfile ? ` para ${selectedProfile.name}` : ""
                    }, pero hay ${hiddenByScore} vacantes scrapeadas ocultas por este filtro.`
                  : `Ninguna vacante llega al ${effectiveMin}% de match${
                      selectedProfile ? ` para ${selectedProfile.name}` : ""
                    }.`
                : "Sin vacantes con este filtro. Dispará una fuente o esperá el cron del perfil."}
            </p>
            {onlyGoodMatch && !isPreMatchStatus && (
              <button
                type="button"
                onClick={() => setOnlyGoodMatch(false)}
                className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {hiddenByScore > 0
                  ? `Ver las ${hiddenByScore} vacantes sin filtro`
                  : "Ver todo lo scrapeado (sin filtro)"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
