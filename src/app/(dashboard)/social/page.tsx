"use client";

import Link from "next/link";
import { useState } from "react";
import { socialApi } from "@/lib/social-api";
import { GoButton, SetupChecklist } from "@/lib/social-setup";
import type { AppConfig, Idea, NotificationList, Profile, SignalListResponse, Usage } from "@/lib/social-types";
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Loading,
  ProfilePicker,
  Score,
  SectionTitle,
  compact,
  fmtDateTime,
  relative,
  topMetric,
  useActiveProfile,
} from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Resumen: qué está pasando con el perfil elegido y los tres botones que se usan a
 * diario (buscar ahora, generar ideas, armar el reporte).
 */
export default function SocialOverview() {
  const { data: profiles, error: profilesError, reload: reloadProfiles } = usePoll<Profile[]>(
    () => socialApi.get("/profiles"),
    30000,
  );
  const { profileId, select } = useActiveProfile(profiles ?? []);
  const profile = (profiles ?? []).find((candidate) => candidate.id === profileId) ?? null;

  const { data: signals } = usePoll<SignalListResponse>(
    () =>
      profileId
        ? socialApi.get(`/signals?limit=5&minRelevance=1&profileId=${profileId}`)
        : Promise.resolve({ total: 0, count: 0, signals: [] }),
    30000,
    [profileId],
  );
  const { data: ideas } = usePoll<Idea[]>(
    () => (profileId ? socialApi.get(`/ideas?profileId=${profileId}&limit=5`) : Promise.resolve([])),
    30000,
    [profileId],
  );
  const { data: unread } = usePoll<NotificationList>(() => socialApi.get("/notifications?unread=true"), 15000);
  const { data: config } = usePoll<AppConfig>(() => socialApi.get("/config"), 120000);
  const { data: usage } = usePoll<Usage>(() => socialApi.get("/usage?days=7"), 60000);

  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(label: string, call: () => Promise<unknown>, after: string) {
    setBusy(label);
    setError(null);
    setDone(null);
    try {
      await call();
      setDone(after);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (profilesError) {
    return (
      <div>
        <h1 className="text-xl font-bold">Social Coach</h1>
        <ErrorBox message={profilesError} />
        <Button variant="secondary" onClick={reloadProfiles}>
          Reintentar
        </Button>
      </div>
    );
  }
  if (!profiles) return <Loading />;

  if (profiles.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold">Social Coach</h1>
        <Card className="mt-4">
          <SectionTitle hint="tres pasos, y con el primero ya podés entrar">Todavía no hay perfiles</SectionTitle>
          <p className="text-sm text-zinc-600">
            Todo lo que hace el harness cuelga de un perfil: sin perfil no sabe a quién le hablás ni de
            qué hablar. La guía te pregunta lo mínimo, guarda cada paso y los dos últimos los podés
            saltear.
          </p>
          <div className="mt-3">
            <GoButton href="/social/empezar">Crear mi primer perfil</GoButton>
          </div>
        </Card>
      </div>
    );
  }

  const cards = [
    { label: "Señales asignadas", value: profile?._count.profileSignals ?? "…", href: "/social/tendencias" },
    { label: "Ideas", value: profile?._count.ideas ?? "…", href: "/social/ideas" },
    { label: "Avisos sin leer", value: unread?.unread ?? 0, href: "/social/notificaciones" },
    {
      label: "IA (7 días)",
      value: usage ? `${compact(usage.totals.tokensIn + usage.totals.tokensOut)} tok` : "…",
      href: "/social/metricas",
    },
  ];

  const pending = (ideas ?? []).filter((idea) => idea.status === "IDEA" || idea.status === "APPROVED");

  return (
    <div>
      <h1 className="text-xl font-bold">Social Coach</h1>
      <p className="mt-1 text-sm text-zinc-500">
        El harness recolecta tendencias del nicho, las puntúa por perfil y te sugiere qué publicar.
        Nada se publica solo: las ideas son propuestas y el borrador lo pedís vos.
      </p>

      <div className="mt-4">
        <ProfilePicker profiles={profiles} value={profileId} onChange={select} />
      </div>

      <SetupChecklist profileId={profileId} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="block">
            <Card className="hover:border-emerald-400">
              <div className="text-xl font-bold sm:text-2xl">{card.value}</div>
              <div className="mt-1 text-xs text-zinc-500">{card.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint={profile ? `nicho: ${profile.niche.join(", ") || "sin declarar"}` : undefined}>
            {profile?.name ?? "Perfil"}
          </SectionTitle>

          <div className="space-y-1 text-sm text-zinc-600">
            <div>
              Cadencia:{" "}
              {profile?.scheduleHours ? `cada ${profile.scheduleHours} h` : "solo manual"} · próxima{" "}
              {relative(profile?.nextRunAt)}
            </div>
            <div>
              Ideas automáticas: {profile?.autoIdeasEnabled ? `sí (hasta ${profile?.ideasPerWeek}/semana)` : "no"} ·
              umbral de relevancia {config?.ideas.relevanceMinScore ?? "…"}
            </div>
            <div>
              Redes: {profile?.accounts.map((account) => account.platform).join(", ") || "sin cuentas"}
            </div>
            <div>
              IA: {config ? `${config.llm.provider}/${config.llm.model}` : "…"}
              {config?.llm.mock && " (mock: sin proveedor real)"}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={busy !== null || !profileId}
              onClick={() =>
                act("run", () => socialApi.post(`/profiles/${profileId}/run`), "Búsqueda encolada: en un momento entran las señales nuevas.")
              }
            >
              {busy === "run" ? "Buscando…" : "Buscar ahora"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null || !profileId}
              onClick={() =>
                act("ideas", () => socialApi.post(`/profiles/${profileId}/ideas`), "Generación de ideas encolada (una llamada de IA).")
              }
            >
              {busy === "ideas" ? "Generando…" : "Generar ideas ahora"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null || !profileId}
              onClick={() =>
                act(
                  "perf",
                  () => socialApi.post(`/profiles/${profileId}/performance/run`, { days: 30 }),
                  "Reporte encolado. Si no hay métricas cargadas, no gasta IA y te avisa.",
                )
              }
            >
              {busy === "perf" ? "Armando…" : "Reporte de rendimiento"}
            </Button>
          </div>

          <ErrorBox message={error} />
          {done && <p className="mt-2 text-sm text-emerald-700">{done}</p>}
        </Card>

        <Card>
          <SectionTitle hint="lo mejor que entró">Tendencias recientes</SectionTitle>
          {(signals?.signals ?? []).length === 0 && (
            <p className="text-sm text-zinc-400">
              Sin señales analizadas todavía. Dale a «Buscar ahora» o pegá una inspiración.
            </p>
          )}
          <ul className="space-y-2">
            {(signals?.signals ?? []).map((signal) => {
              const relevance = signal.relevance[0];
              return (
                <li key={signal.id} className="border-b border-zinc-100 pb-2 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm">{signal.title}</span>
                    <Score score={relevance?.score ?? 0} />
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {signal.platform ?? signal.kind} · {relative(signal.publishedAt ?? signal.createdAt)}
                    {topMetric(signal.metrics) > 0 && ` · ${compact(topMetric(signal.metrics))} de alcance`}
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href="/social/tendencias" className="mt-3 inline-block text-sm text-emerald-700 underline">
            Ver todas las tendencias
          </Link>
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle hint="lo que está esperando tu decisión">Próximas ideas</SectionTitle>
        {pending.length === 0 && (
          <p className="text-sm text-zinc-400">
            No hay ideas pendientes. Se generan solas cuando algo pasa el umbral, o a mano con «Generar ideas ahora».
          </p>
        )}
        <ul className="space-y-2">
          {pending.map((idea) => (
            <li key={idea.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0">
              <Link href={`/social/ideas/${idea.id}`} className="text-sm hover:underline">
                {idea.title}
              </Link>
              <span className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <Badge tone="zinc">
                  {idea.platform}/{idea.format}
                </Badge>
                <Badge tone={idea.source === "ia" ? "emerald" : "amber"}>
                  {idea.source === "ia" ? "IA" : idea.source}
                </Badge>
                {idea.scheduledFor && <span>{fmtDateTime(idea.scheduledFor)}</span>}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/social/ideas" className="mt-3 inline-block text-sm text-emerald-700 underline">
          Ver el calendario completo
        </Link>
      </Card>
    </div>
  );
}
