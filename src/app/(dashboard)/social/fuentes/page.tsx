"use client";

import { useState } from "react";
import { socialApi } from "@/lib/social-api";
import type { Profile, Source } from "@/lib/social-types";
import { sourceTarget } from "@/lib/social-types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Input,
  Loading,
  ProfilePicker,
  SectionTitle,
  Select,
  fmtDateTime,
  relative,
  useActiveProfile,
} from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Fuentes: el catálogo de dónde salen las tendencias y cuáles usa cada perfil.
 *
 * Sumar un tipo de fuente es agregar su adaptador en el harness: acá solo se elige
 * cuáles alimentan al perfil (y se pueden verificar antes de guardarlas).
 */
const KINDS = [
  { value: "RSS", label: "RSS / Atom", hint: "cualquier feed (medios, blogs, YouTube por feed)" },
  { value: "YOUTUBE_API", label: "YouTube (API)", hint: "busca por temas y trae estadísticas reales" },
  { value: "GOOGLE_TRENDS", label: "Google Trends", hint: "interés de búsqueda por tema y país" },
  { value: "PUBLIC_WEB", label: "Página pública", hint: "una lista con selectores CSS" },
  { value: "MANUAL", label: "Manual", hint: "lo que pegás vos" },
];

export default function SocialSources() {
  const { data: profiles } = usePoll<Profile[]>(() => socialApi.get("/profiles"), 60000);
  const { profileId, select } = useActiveProfile(profiles ?? []);
  const profile = (profiles ?? []).find((candidate) => candidate.id === profileId) ?? null;
  const { data: sources, reload } = usePoll<Source[]>(() => socialApi.get("/sources"), 30000);
  const { data: templates } = usePoll<Array<Record<string, unknown>>>(
    () => socialApi.get("/sources/templates"),
    300000,
  );

  const [kind, setKind] = useState("RSS");
  const [name, setName] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [keywords, setKeywords] = useState("");
  const [region, setRegion] = useState("CO");
  const [itemSelector, setItemSelector] = useState("");
  const [titleSelector, setTitleSelector] = useState("");
  const [urlSelector, setUrlSelector] = useState("");
  const [probe, setProbe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const linked = new Set((profile?.sources ?? []).map((link) => link.source.id));
  const kindHint = KINDS.find((item) => item.value === kind)?.hint;

  /** Los `params` cambian según el tipo: es el mismo contrato que valida la API. */
  function buildParams(): Record<string, unknown> | null {
    const keywordList = keywords
      .split(",")
      .map((term) => term.trim())
      .filter((term) => term.length >= 2);

    switch (kind) {
      case "RSS":
        return urlValue.trim() ? { feedUrl: urlValue.trim() } : null;
      case "YOUTUBE_API":
        return keywordList.length > 0 ? { keywords: keywordList, region } : null;
      case "GOOGLE_TRENDS":
        return keywordList.length > 0 ? { keywords: keywordList, region } : null;
      case "PUBLIC_WEB":
        return urlValue.trim() && itemSelector.trim()
          ? {
              listUrl: urlValue.trim(),
              recipe: {
                selectors: {
                  item: itemSelector.trim(),
                  ...(titleSelector.trim() ? { title: titleSelector.trim() } : {}),
                  ...(urlSelector.trim() ? { url: urlSelector.trim() } : {}),
                },
              },
            }
          : null;
      case "MANUAL":
        return {};
      default:
        return null;
    }
  }

  async function run(label: string, call: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await call();
      setMessage(ok);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleLink(sourceId: string, isLinked: boolean) {
    if (!profile) return;
    const next = isLinked ? [...linked].filter((id) => id !== sourceId) : [...linked, sourceId];
    return run("link", () => socialApi.patch(`/profiles/${profile.id}/sources`, { sourceIds: next }), isLinked ? "Fuente desvinculada." : "Fuente vinculada al perfil.");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Fuentes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            De acá salen las tendencias. Una fuente se recolecta UNA vez y sus señales se reparten
            entre los perfiles que la tengan vinculada.
          </p>
        </div>
        <Button variant="secondary" onClick={reload}>
          Actualizar
        </Button>
      </div>

      <div className="mt-4">
        <ProfilePicker profiles={profiles ?? []} value={profileId} onChange={select} />
      </div>

      <ErrorBox message={error} />
      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}

      <Card className="mt-2">
        <SectionTitle hint={kindHint}>Agregar una fuente</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tipo">
            <Select value={kind} onChange={(event) => setKind(event.target.value)}>
              {KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nombre">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Medios del nicho" />
          </Field>
          {(kind === "RSS" || kind === "PUBLIC_WEB") && (
            <Field label={kind === "RSS" ? "URL del feed" : "URL de la lista"}>
              <Input value={urlValue} onChange={(event) => setUrlValue(event.target.value)} placeholder="https://…" />
            </Field>
          )}
          {(kind === "YOUTUBE_API" || kind === "GOOGLE_TRENDS") && (
            <>
              <Field label="Temas (separados por comas)">
                <Input
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  placeholder="inteligencia artificial, automatización"
                />
              </Field>
              <Field label="País (2 letras)">
                <Input value={region} maxLength={2} onChange={(event) => setRegion(event.target.value.toUpperCase())} />
              </Field>
            </>
          )}
          {kind === "PUBLIC_WEB" && (
            <>
              <Field label="Selector del elemento" hint="obligatorio: el contenedor de cada ítem">
                <Input value={itemSelector} onChange={(event) => setItemSelector(event.target.value)} placeholder=".trend-card" />
              </Field>
              <Field label="Selector del título">
                <Input value={titleSelector} onChange={(event) => setTitleSelector(event.target.value)} placeholder="h3" />
              </Field>
              <Field label="Selector del enlace">
                <Input value={urlSelector} onChange={(event) => setUrlSelector(event.target.value)} placeholder="a" />
              </Field>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy || !buildParams()}
            onClick={async () => {
              const params = buildParams();
              if (!params) return;
              setBusy(true);
              setError(null);
              setProbe(null);
              try {
                const result = await socialApi.post<{ items: unknown[]; warnings: string[] }>("/sources/probe", {
                  kind,
                  params,
                });
                setProbe(
                  `La verificación leyó ${result.items.length} ítem(s).` +
                    (result.warnings.length > 0 ? ` Avisos: ${result.warnings.join(" · ")}` : ""),
                );
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Verificar sin guardar
          </Button>
          <Button
            disabled={busy || name.trim().length < 2 || !buildParams()}
            onClick={() => {
              const params = buildParams();
              if (!params) return;
              void run(
                "create",
                () => socialApi.post("/sources", { name: name.trim(), kind, params }),
                "Fuente creada. Vinculala al perfil para que empiece a traer señales.",
              );
            }}
          >
            Guardar fuente
          </Button>
        </div>
        {probe && <p className="mt-2 text-sm text-emerald-700">{probe}</p>}
      </Card>

      <Card className="mt-4">
        <SectionTitle hint={profile ? `para ${profile.name}` : "elegí un perfil"}>
          Fuentes del catálogo
        </SectionTitle>
        {!sources ? (
          <Loading />
        ) : sources.length === 0 ? (
          <Empty>Sin fuentes: creá la primera arriba.</Empty>
        ) : (
          <ul className="space-y-2">
            {sources.map((source) => (
              <li key={source.id} className="border-b border-zinc-100 pb-2 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{source.name}</span>
                      <Badge tone="zinc">{source.kind}</Badge>
                      {linked.has(source.id) && <Badge tone="emerald">vinculada</Badge>}
                      {!source.enabled && <Badge tone="amber">deshabilitada</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {sourceTarget(source)}
                      {source.lastRunAt && ` · última corrida ${relative(source.lastRunAt)}`}
                      {source.intervalHours ? ` · cada ${source.intervalHours} h` : ""}
                    </div>
                    {source.lastError && (
                      <div className="mt-1 text-xs text-red-600">Error: {source.lastError.slice(0, 200)}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={linked.has(source.id) ? "danger" : "secondary"}
                      disabled={busy || !profile}
                      onClick={() => void toggleLink(source.id, linked.has(source.id))}
                    >
                      {linked.has(source.id) ? "Desvincular" : "Vincular al perfil"}
                    </Button>
                    {linked.has(source.id) && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          run(
                            "toggle",
                            () =>
                              socialApi.patch(`/profiles/${profile?.id}/sources/${source.id}`, {
                                enabled: !(profile?.sources.find((link) => link.source.id === source.id)?.enabled ?? true),
                              }),
                            "Fuente actualizada para el perfil.",
                          )
                        }
                      >
                        Activar / pausar en el perfil
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {templates && templates.length > 0 && (
        <Card className="mt-4">
          <SectionTitle hint="configuraciones listas">Plantillas de fuente</SectionTitle>
          <ul className="space-y-2 text-sm">
            {templates.map((template, index) => (
              <li key={index} className="border-b border-zinc-100 pb-2 last:border-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{String(template.name ?? template.kind ?? "Plantilla")}</span>
                  {typeof template.kind === "string" && <Badge tone="zinc">{template.kind}</Badge>}
                </div>
                {typeof template.description === "string" && (
                  <p className="mt-1 text-xs text-zinc-500">{template.description}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-xs text-zinc-400">
        Última actualización del catálogo: {fmtDateTime(new Date().toISOString())}
      </p>
    </div>
  );
}
