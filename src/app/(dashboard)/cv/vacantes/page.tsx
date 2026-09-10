"use client";

import Link from "next/link";
import { useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { Score, StatusBadge } from "@/lib/cv-ui";
import { usePoll } from "@/lib/usePoll";
import type { VacancyRow } from "@/lib/cv-types";

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
  const [onlyGoodMatch, setOnlyGoodMatch] = useState(true);
  const [minScore, setMinScore] = useState(String(DEFAULT_MIN_SCORE));

  const effectiveMin = onlyGoodMatch ? Math.max(0, Number(minScore) || DEFAULT_MIN_SCORE) : null;
  const params = new URLSearchParams({ status, limit: "100" });
  if (q) params.set("q", q);
  if (effectiveMin !== null) params.set("minScore", String(effectiveMin));

  const { data, error, reload } = usePoll<ListResponse>(
    () => cvApi.get(`/vacancies?${params.toString()}`),
    15000,
    [status, onlyGoodMatch, minScore],
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-bold">Vacantes</h1>
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
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && reload()}
          placeholder="Buscar…"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-xs text-zinc-500">{data?.total ?? 0} resultados</span>
      </div>

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
            ? "Se ocultan las vacantes sin match suficiente (y las aún no analizadas)."
            : "Mostrando todo lo scrapeado, incluido lo que no encaja con tus perfiles."}
        </span>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="flex flex-col gap-2">
        {(data?.rows ?? []).map((v) => (
          <Link
            key={v.id}
            href={`/cv/vacantes/${v.id}`}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm hover:border-emerald-400"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{v.title}</div>
              <div className="truncate text-sm text-zinc-500">
                {[v.company, v.location, v.salary].filter(Boolean).join(" · ") || "—"}
                <span className="ml-2 text-xs text-zinc-400">{v.source.name}</span>
              </div>
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
              ? `Ninguna vacante llega al ${effectiveMin}% de match. Destildá «Solo buen match» para ver todo lo scrapeado.`
              : "Sin vacantes con este filtro. Dispará una fuente o esperá el cron del perfil."}
          </p>
        )}
      </div>
    </div>
  );
}
