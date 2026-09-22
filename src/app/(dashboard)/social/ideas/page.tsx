"use client";

import Link from "next/link";
import { useState } from "react";
import { socialApi } from "@/lib/social-api";
import type { Idea, PlatformDef, Profile } from "@/lib/social-types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  IDEA_STATUS_LABEL,
  IDEA_STATUS_TONE,
  Input,
  Loading,
  ProfilePicker,
  SectionTitle,
  Select,
  Textarea,
  fmtDate,
  fmtDateTime,
  useActiveProfile,
} from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Ideas y calendario.
 *
 * Es la pantalla donde el humano decide: aprobar, mover, publicar o descartar. El
 * estado lo cambia la persona; el coach solo propone (por eso nada acá es automático).
 */
export default function SocialIdeas() {
  const { data: profiles } = usePoll<Profile[]>(() => socialApi.get("/profiles"), 60000);
  const { profileId, select } = useActiveProfile(profiles ?? []);
  const { data: platforms } = usePoll<PlatformDef[]>(() => socialApi.get("/platforms"), 300000);
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: ideas, error: pollError, reload } = usePoll<Idea[]>(
    () => socialApi.get(`/ideas?profileId=${profileId}${status ? `&status=${status}` : ""}&limit=100`),
    30000,
    [profileId, status],
  );

  const [form, setForm] = useState({
    platform: "LINKEDIN",
    format: "POST",
    title: "",
    hook: "",
    angle: "",
    scheduledFor: "",
  });

  const selectedPlatform = (platforms ?? []).find((item) => item.key === form.platform);

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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Ideas y calendario</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cada idea viene con su por qué (las señales que la sostienen) y el formato que existe en
            esa red. Vos decidís qué se publica.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !profileId}
            onClick={() =>
              run(
                "gen",
                () => socialApi.post(`/profiles/${profileId}/ideas`),
                "Generando ideas (una llamada de IA). Aparecen en un momento.",
              )
            }
          >
            Generar ideas ahora
          </Button>
          <Button variant="secondary" onClick={() => setCreating((value) => !value)}>
            {creating ? "Cancelar" : "Cargar una idea"}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <ProfilePicker profiles={profiles ?? []} value={profileId} onChange={select} />
      </div>

      {creating && (
        <Card className="mt-2">
          <SectionTitle hint="lo que salga de acá es tuyo, no lo escribió la IA">Idea a mano</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Red">
              <Select
                value={form.platform}
                onChange={(event) => {
                  const next = event.target.value;
                  const formats = (platforms ?? []).find((item) => item.key === next)?.formats ?? [];
                  setForm({
                    ...form,
                    platform: next,
                    format: formats.includes(form.format) ? form.format : (formats[0] ?? ""),
                  });
                }}
              >
                {(platforms ?? []).map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Formato" hint={selectedPlatform?.hashtagsHint}>
              <Select value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })}>
                {(selectedPlatform?.formats ?? []).map((format) => (
                  <option key={format} value={format}>
                    {(selectedPlatform?.formatDetails ?? []).find((detail) => detail.key === format)?.label ?? format}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Título">
              <Input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="De qué se trata la pieza"
              />
            </Field>
            <Field label="Fecha sugerida">
              <Input
                type="date"
                value={form.scheduledFor}
                onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })}
              />
            </Field>
            <Field label="Gancho" hint="la primera línea">
              <Input value={form.hook} onChange={(event) => setForm({ ...form, hook: event.target.value })} />
            </Field>
            <Field label="Enfoque">
              <Textarea
                rows={3}
                value={form.angle}
                onChange={(event) => setForm({ ...form, angle: event.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button
              disabled={busy || form.title.length < 3 || form.hook.length < 3 || form.angle.length < 3}
              onClick={() =>
                run(
                  "create",
                  () =>
                    socialApi.post("/ideas", {
                      profileId,
                      platform: form.platform,
                      format: form.format,
                      title: form.title,
                      hook: form.hook,
                      angle: form.angle,
                      ...(form.scheduledFor ? { scheduledFor: form.scheduledFor } : {}),
                    }),
                  "Idea cargada.",
                )
              }
            >
              Guardar idea
            </Button>
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Estado:</span>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-[220px]">
            <option value="">Todas</option>
            {Object.entries(IDEA_STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <ErrorBox message={error ?? pollError} />
      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}

      {!ideas ? (
        <Loading />
      ) : ideas.length === 0 ? (
        <Card className="mt-4">
          <Empty>
            No hay ideas con este filtro. Se generan solas cuando una señal pasa el umbral, o a mano
            con «Generar ideas ahora».
          </Empty>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {ideas.map((idea) => (
            <Card key={idea.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/social/ideas/${idea.id}`} className="text-sm font-medium hover:underline">
                    {idea.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <Badge tone={IDEA_STATUS_TONE[idea.status] ?? "zinc"}>
                      {IDEA_STATUS_LABEL[idea.status] ?? idea.status}
                    </Badge>
                    <Badge tone="zinc">
                      {idea.platform}/{idea.format}
                    </Badge>
                    <Badge tone={idea.source === "ia" ? "emerald" : idea.source === "manual" ? "blue" : "amber"}>
                      {idea.source === "ia" ? "IA" : idea.source === "manual" ? "a mano" : "plantilla"}
                    </Badge>
                    {idea.scheduledFor && <span>calendario: {fmtDateTime(idea.scheduledFor)}</span>}
                    {idea.publishedAt && <span>publicada: {fmtDate(idea.publishedAt)}</span>}
                  </div>
                </div>
              </div>

              <p className="mt-2 text-sm text-zinc-700">{idea.hook}</p>
              <p className="mt-1 text-sm text-zinc-600">{idea.angle}</p>
              <p className="mt-2 text-xs text-zinc-500">
                <span className="font-medium">Por qué ahora:</span> {idea.whyNow}
              </p>

              {(idea.signals ?? []).length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-zinc-500">
                  {(idea.signals ?? []).map((link) => (
                    <li key={link.id}>
                      · se apoya en:{" "}
                      {link.signal.url ? (
                        <a href={link.signal.url} target="_blank" rel="noreferrer" className="underline">
                          {link.signal.title}
                        </a>
                      ) : (
                        link.signal.title
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {idea.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {idea.hashtags.map((tag) => (
                    <Badge key={tag} tone="zinc">
                      #{tag.replace(/^#/, "")}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/social/ideas/${idea.id}`}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
                >
                  Abrir
                </Link>
                {idea.status === "IDEA" && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      run("approve", () => socialApi.patch(`/ideas/${idea.id}`, { status: "APPROVED" }), "Aprobada.")
                    }
                  >
                    Aprobar
                  </Button>
                )}
                {idea.status !== "PUBLISHED" && idea.status !== "DISCARDED" && (
                  <>
                    <Button variant="secondary" onClick={() => setPublishing(publishing === idea.id ? null : idea.id)}>
                      Ya publiqué
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        run("discard", () => socialApi.patch(`/ideas/${idea.id}`, { status: "DISCARDED" }), "Descartada.")
                      }
                    >
                      Descartar
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm("¿Borrar la idea? No se puede deshacer.")) {
                      void run("del", () => socialApi.del(`/ideas/${idea.id}`), "Borrada.");
                    }
                  }}
                >
                  Borrar
                </Button>
              </div>

              {publishing === idea.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-zinc-50 p-3">
                  <Field label="Enlace de la pieza (opcional)" hint="es lo que permite atribuir rendimiento después">
                    <Input
                      value={publishedUrl}
                      onChange={(event) => setPublishedUrl(event.target.value)}
                      placeholder="https://…"
                    />
                  </Field>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(
                        "publish",
                        () =>
                          socialApi.post(`/ideas/${idea.id}/published`, {
                            ...(publishedUrl.trim() ? { url: publishedUrl.trim() } : {}),
                          }),
                        "Marcada como publicada.",
                      ).then(() => {
                        setPublishing(null);
                        setPublishedUrl("");
                      })
                    }
                  >
                    Confirmar
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
