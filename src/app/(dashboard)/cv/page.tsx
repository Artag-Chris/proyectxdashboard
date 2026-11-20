"use client";

import Link from "next/link";
import { cvApi } from "@/lib/cv-api";
import { Card } from "@/lib/cv-ui";
import { usePoll } from "@/lib/usePoll";
import type { CvUsageSummary, ProfileRow, SourceRow } from "@/lib/cv-types";

interface VacancyListResponse {
  total: number;
}

const STAGE_LABELS: Record<string, string> = {
  normalize: "Normalización",
  match: "Match",
  resume: "Generar HV",
  "custom-resume": "HV por prompt",
  "cover-letter": "Carta",
  refine: "Refinar HV",
  translate: "Traducir",
  ats: "Keywords ATS",
  interview: "Entrevista",
  import: "Importar CV",
  probe: "Probe fuente",
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}

export default function CvOverview() {
  const { data: profiles } = usePoll<ProfileRow[]>(() => cvApi.get("/profiles"), 30000);
  const { data: sources } = usePoll<SourceRow[]>(() => cvApi.get("/sources"), 30000);
  const { data: vacancies } = usePoll<VacancyListResponse>(
    () => cvApi.get("/vacancies?status=ALL&limit=1"),
    30000,
  );
  const { data: unread } = usePoll<number>(
    () => cvApi.get("/notifications/unread-count"),
    15000,
  );
  const { data: usage } = usePoll<CvUsageSummary>(
    () => cvApi.get("/usage"),
    30000,
  );

  const resumesReady = (profiles ?? []).reduce(
    (acc, p) => acc + p._count.resumes,
    0,
  );
  const activeSources = (sources ?? []).filter((s) => s.enabled).length;

  const cards = [
    { label: "Vacantes", value: vacancies?.total ?? "…", href: "/cv/vacantes" },
    { label: "Fuentes activas", value: activeSources, href: "/cv/fuentes" },
    { label: "Perfiles", value: profiles?.length ?? "…", href: "/cv/perfiles" },
    { label: "CV indexados", value: resumesReady, href: "/cv/perfiles" },
    {
      label: "Notificaciones sin leer",
      value: unread ?? 0,
      href: "/cv/notificaciones",
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold">CV Harness</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Búsqueda por perfil: sus fuentes scrapean, el pipeline matchea contra la HV activa
        (vectores en pgvector + análisis IA) y te avisa cuando hay un borrador listo.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="block">
            <Card className="hover:border-emerald-400">
              <div className="text-xl font-bold sm:text-2xl">{c.value}</div>
              <div className="mt-1 text-xs text-zinc-500">{c.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-emerald-700">Perfiles con cron</h2>
          <ul className="space-y-1 text-sm">
            {(profiles ?? []).length === 0 && <li className="text-zinc-400">Sin perfiles.</li>}
            {(profiles ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-b border-zinc-100 py-1 last:border-0">
                <span className="break-words">
                  {p.name}
                  {p.isPrimary && " ★"}
                </span>
                <span className="text-zinc-500">
                  {p.scheduleMinutes ? `cada ${p.scheduleMinutes} min` : "cron off"} ·{" "}
                  {p._count.sources} fuentes · {p._count.resumes} CV
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-emerald-700">Cómo funciona</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600">
            <li>Cargá tu hoja de vida por perfil (PDF o texto) — se indexa en pgvector.</li>
            <li>Creá fuentes con plantilla + URL del listado y asignalas al perfil.</li>
            <li>Configurá el cron del perfil o usá «Buscar ahora».</li>
            <li>El match es híbrido: similitud semántica CV ↔ vacante + análisis IA.</li>
            <li>Con score suficiente se genera el borrador de HV y cae la notificación acá.</li>
          </ol>
        </Card>
      </div>

      {usage && (
        <Card className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-emerald-700">
                Consumo de IA y tope diario
              </h2>
              <p className="text-xs text-zinc-500">
                Proveedor: <span className="font-medium text-zinc-700">{usage.config.provider}</span>{" "}
                ({usage.config.model}) · reinicio diario 00:00 UTC · salida máx:{" "}
                {usage.config.maxOutputTokens > 0
                  ? `${usage.config.maxOutputTokens} tok`
                  : "sin tope"}
              </p>
            </div>
            {usage.today.budgetExceeded ? (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                Tope alcanzado · respaldo determinístico hasta 00:00 UTC
              </span>
            ) : usage.today.tokenLimit > 0 || usage.today.usdLimit > 0 ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Dentro del tope diario
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                Sin tope diario configurado
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">Tokens hoy ({usage.today.day})</div>
              <div className="mt-1 text-lg font-bold">
                {fmtTokens(usage.today.totalTokens)}
              </div>
              <div className="text-[11px] text-zinc-500">
                in {fmtTokens(usage.today.tokensIn)} · out {fmtTokens(usage.today.tokensOut)}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">Llamadas hoy</div>
              <div className="mt-1 text-lg font-bold">{usage.today.calls}</div>
              <div className="text-[11px] text-zinc-500">
                acumulado: {usage.total.calls}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">Costo estimado hoy</div>
              <div className="mt-1 text-lg font-bold">{fmtUsd(usage.today.costUsd)}</div>
              <div className="text-[11px] text-zinc-500">
                {usage.today.usdLimit > 0
                  ? `tope: ${fmtUsd(usage.today.usdLimit)}`
                  : "sin tope USD"}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">Acumulado histórico</div>
              <div className="mt-1 text-lg font-bold">{fmtUsd(usage.total.costUsd)}</div>
              <div className="text-[11px] text-zinc-500">
                {fmtTokens(usage.total.totalTokens)} tokens
              </div>
            </div>
          </div>

          {usage.today.tokenLimit > 0 && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-zinc-600">
                <span>Tope diario de tokens</span>
                <span>
                  {fmtTokens(usage.today.totalTokens)} / {fmtTokens(usage.today.tokenLimit)} (
                  {Math.min(
                    100,
                    Math.round((usage.today.totalTokens / usage.today.tokenLimit) * 100),
                  )}
                  %)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full transition-all ${
                    usage.today.budgetExceeded ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((usage.today.totalTokens / usage.today.tokenLimit) * 100),
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {usage.byStage.length > 0 && (
            <div className="mt-4 border-t border-zinc-100 pt-3">
              <div className="mb-1.5 text-xs font-medium text-zinc-500">
                Desglose de hoy por etapa
              </div>
              <div className="flex flex-wrap gap-2">
                {usage.byStage.map((s) => (
                  <span
                    key={s.stage}
                    className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700"
                  >
                    <span className="font-medium">
                      {STAGE_LABELS[s.stage] ?? s.stage}:
                    </span>{" "}
                    {s.calls}x · {fmtTokens(s.totalTokens)} tok ({fmtUsd(s.costUsd)})
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
