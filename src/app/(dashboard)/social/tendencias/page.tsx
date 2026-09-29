"use client";

import { useState } from "react";
import { socialApi } from "@/lib/social-api";
import { LockedCard } from "@/lib/social-setup";
import type { Profile, SignalListResponse } from "@/lib/social-types";
import { platformList } from "@/lib/social-types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Loading,
  ProfilePicker,
  SIGNAL_KIND_LABEL,
  Score,
  Select,
  compact,
  fmtDate,
  relative,
  topMetric,
  useActiveProfile,
} from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Tendencias: las señales que le tocaron al perfil, ordenadas por relevancia, con el
 * por qué de cada puntaje. Es la materia prima del coach: si algo no está acá, no se
 * puede convertir en idea.
 */
export default function SocialTrends() {
  const { data: profiles } = usePoll<Profile[]>(() => socialApi.get("/profiles"), 60000);
  const { profileId, select } = useActiveProfile(profiles ?? []);
  const profile = (profiles ?? []).find((candidate) => candidate.id === profileId) ?? null;
  // Sin fuentes activas no hay de dónde traer señales: es el paso que desbloquea esta pestaña.
  const sinFuentes = !!profile && profile.sources.filter((source) => source.enabled).length === 0;
  const { data: platformsData } = usePoll<unknown>(() => socialApi.get("/platforms"), 300000);
  // `GET /platforms` devuelve `{ platforms: [...] }`: se normaliza una sola vez acá.
  const platforms = platformList(platformsData);

  const [minRelevance, setMinRelevance] = useState("1");
  const [days, setDays] = useState("30");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams({
    limit: "60",
    minRelevance,
    profileId,
    ...(days ? { days } : {}),
    ...(kind ? { kind } : {}),
    ...(search ? { q: search } : {}),
  });

  const { data, error: pollError, reload } = usePoll<SignalListResponse>(
    () =>
      profileId
        ? socialApi.get(`/signals?${params.toString()}`)
        : Promise.resolve({ total: 0, count: 0, signals: [] }),
    30000,
    [profileId, minRelevance, days, kind, search],
  );

  async function searchNow() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await socialApi.post<{ sourcesDispatched: number }>(`/profiles/${profileId}/run`);
      setNotice(
        `Búsqueda encolada en ${result.sourcesDispatched} fuente(s). Las señales nuevas tardan un momento (y después el análisis).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Tendencias</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Señales del perfil con su relevancia. El puntaje sale del prefilter (gratis) y del análisis
            con IA, y siempre viene con motivos.
          </p>
        </div>
        <Button disabled={busy || !profileId} onClick={searchNow}>
          {busy ? "Buscando…" : "Buscar ahora"}
        </Button>
      </div>

      <div className="mt-4">
        <ProfilePicker profiles={profiles ?? []} value={profileId} onChange={select} />
      </div>

      <Card className="mt-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Relevancia mínima</span>
            <Select value={minRelevance} onChange={(event) => setMinRelevance(event.target.value)}>
              <option value="1">Todas las analizadas</option>
              <option value="40">40 o más</option>
              <option value="60">60 o más (umbral de ideas)</option>
              <option value="80">80 o más</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Antigüedad</span>
            <Select value={days} onChange={(event) => setDays(event.target.value)}>
              <option value="">Sin límite</option>
              <option value="7">Últimos 7 días</option>
              <option value="30">Últimos 30 días</option>
              <option value="90">Últimos 90 días</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Tipo</span>
            <Select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="">Todos</option>
              {Object.entries(SIGNAL_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(query);
            }}
            className="flex items-end gap-2"
          >
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-zinc-500">Buscar</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="tema, autor…"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            </label>
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
          </form>
        </div>
      </Card>

      <ErrorBox message={error ?? pollError} />
      {notice && <p className="mt-2 text-sm text-emerald-700">{notice}</p>}

      {!data ? (
        <Loading />
      ) : data.signals.length === 0 ? (
        sinFuentes ? (
          <LockedCard
            title="Todavía no hay de dónde traer señales"
            requirement="Las señales (tendencias, noticias, videos) entran por las fuentes que le conectás al perfil. No tiene ninguna activa, así que no hay nada que buscar."
            href="/social/fuentes"
            actionLabel="Conectar una fuente"
          />
        ) : (
          <Card className="mt-4">
            <Empty>
              No hay señales para estos filtros. Dale a «Buscar ahora» o pegá una inspiración.
            </Empty>
          </Card>
        )
      ) : (
        <div className="mt-4 space-y-3">
          <div className="text-xs text-zinc-500">
            {data.count} de {data.total} señales
          </div>
          {data.signals.map((signal) => {
            const relevance = signal.relevance[0];
            const reach = topMetric(signal.metrics);
            const platformLabel =
              platforms.find((platform) => platform.key === signal.platform)?.label ?? signal.platform;
            return (
              <Card key={signal.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {signal.url ? (
                        <a
                          href={signal.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium hover:underline"
                        >
                          {signal.title}
                        </a>
                      ) : (
                        <span className="text-sm font-medium">{signal.title}</span>
                      )}
                      {signal.isDuplicate && <Badge tone="amber">duplicada</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <Badge tone="zinc">{SIGNAL_KIND_LABEL[signal.kind] ?? signal.kind}</Badge>
                      {platformLabel && <span>{platformLabel}</span>}
                      <span>{relative(signal.publishedAt ?? signal.createdAt)}</span>
                      {signal.source && <span>· {signal.source.name}</span>}
                      {reach > 0 && <span>· {compact(reach)} de alcance</span>}
                      {signal.author && <span>· {signal.author}</span>}
                    </div>
                  </div>
                  <Score score={relevance?.score ?? 0} />
                </div>

                {signal.summary && <p className="mt-2 text-sm text-zinc-600">{signal.summary}</p>}

                {(relevance?.reasons ?? []).length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
                    {(relevance?.reasons ?? []).map((reason) => (
                      <li key={reason}>· {reason}</li>
                    ))}
                  </ul>
                )}

                {signal.keywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {signal.keywords.slice(0, 8).map((keyword) => (
                      <Badge key={keyword} tone="zinc">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="mt-2 text-xs text-zinc-400">
                  Detectada el {fmtDate(signal.createdAt)}
                  {relevance && relevance.status !== "NEW" && ` · estado: ${relevance.status.toLowerCase()}`}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {data && (
        <div className="mt-4">
          <Button variant="secondary" onClick={reload}>
            Actualizar
          </Button>
        </div>
      )}
    </div>
  );
}
