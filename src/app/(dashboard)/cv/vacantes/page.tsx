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

  const { data: profiles } = usePoll<ProfileRow[]>(() => cvApi.get("/profiles"), 30000);

  const effectiveMin = onlyGoodMatch ? Math.max(0, Number(minScore) || DEFAULT_MIN_SCORE) : null;
  const params = new URLSearchParams({ status, limit: "100" });
  if (q) params.set("q", q);
  if (profileId) params.set("profileId", profileId);
  if (modality) params.set("modality", modality);
  if (seniority) params.set("seniority", seniority);
  if (location.trim()) params.set("location", location.trim());
  if (effectiveMin !== null) params.set("minScore", String(effectiveMin));

  const { data, error, reload } = usePoll<ListResponse>(
    () => cvApi.get(`/vacancies?${params.toString()}`),
    15000,
    [status, q, profileId, modality, seniority, location, onlyGoodMatch, minScore],
  );

  const selectedProfile = (profiles ?? []).find((p) => p.id === profileId) ?? null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-bold">Vacantes</h1>
        <select
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
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
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
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
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
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
          className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
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
          className="w-36 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && reload()}
          placeholder="Buscar…"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-xs text-zinc-500">{data?.total ?? 0} resultados</span>
      </div>

      {selectedProfile && (
        <p className="mb-2 text-xs text-emerald-700">
          Viendo solo las vacantes evaluadas para <b>{selectedProfile.name}</b>, con su score
          propio.
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
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
              className="w-14 rounded-lg border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            %
          </label>
        )}
        <span className="text-xs text-zinc-400">
          {onlyGoodMatch
            ? selectedProfile
              ? `Se ocultan las vacantes que no llegan al ${effectiveMin}% para ${selectedProfile.name}.`
              : "Se ocultan las vacantes sin match suficiente (y las aún no analizadas)."
            : "Mostrando todo lo scrapeado, incluido lo que no encaja con tus perfiles."}
        </span>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        {(data?.rows ?? []).map((v) => (
          <Link
            key={v.id}
            href={`/cv/vacantes/${v.id}${profileId ? `?profileId=${profileId}` : ""}`}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm hover:border-emerald-400"
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
            <div className="w-10 text-right">
              <Score score={v.matchScore} />
            </div>
          </Link>
        ))}
        {data && data.rows.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
            {onlyGoodMatch
              ? `Ninguna vacante llega al ${effectiveMin}% de match${
                  selectedProfile ? ` para ${selectedProfile.name}` : ""
                }. Destildá «Solo buen match» para ver todo lo scrapeado.`
              : "Sin vacantes con este filtro. Dispará una fuente o esperá el cron del perfil."}
          </p>
        )}
      </div>
    </div>
  );
}
