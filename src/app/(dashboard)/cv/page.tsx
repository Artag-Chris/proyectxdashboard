"use client";

import Link from "next/link";
import { cvApi } from "@/lib/cv-api";
import { Card } from "@/lib/cv-ui";
import { usePoll } from "@/lib/usePoll";
import type { ProfileRow, SourceRow } from "@/lib/cv-types";

interface VacancyListResponse {
  total: number;
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

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="block">
            <Card className="hover:border-emerald-400">
              <div className="text-2xl font-bold">{c.value}</div>
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
              <li key={p.id} className="flex justify-between gap-2 border-b border-zinc-100 py-1 last:border-0">
                <span>
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
    </div>
  );
}
