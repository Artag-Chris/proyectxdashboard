"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { socialApi } from "@/lib/social-api";
import type { Draft, Idea, PlatformDef } from "@/lib/social-types";
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  IDEA_STATUS_LABEL,
  IDEA_STATUS_TONE,
  Input,
  Loading,
  SectionTitle,
  Textarea,
  fmtDate,
  fmtDateTime,
} from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Detalle de la idea: el por qué (señales), el borrador (a demanda) y el cierre
 * ("ya publiqué").
 *
 * El borrador es lo único que se pide explícitamente: el pipeline nunca escribe solo.
 */
export default function SocialIdeaDetail() {
  const params = useParams<{ id: string }>();
  const ideaId = params?.id ?? "";

  const { data: platforms } = usePoll<PlatformDef[]>(() => socialApi.get("/platforms"), 300000);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [draftForm, setDraftForm] = useState({ caption: "", script: "", cta: "", notes: "" });
  const [publishedUrl, setPublishedUrl] = useState("");
  const [showPublish, setShowPublish] = useState(false);
  const [ideaForm, setIdeaForm] = useState({ title: "", hook: "", angle: "" });

  async function load() {
    if (!ideaId) return;
    try {
      const data = await socialApi.get<Idea>(`/ideas/${ideaId}`);
      setIdea(data);
      setIdeaForm({ title: data.title, hook: data.hook, angle: data.angle });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId]);

  /**
   * Mientras se genera el borrador hay que refrescar: el trabajo corre en la cola y
   * el resultado aparece en la idea (es una llamada de IA, tarda unos segundos).
   */
  const [waitingDraft, setWaitingDraft] = useState(false);
  useEffect(() => {
    if (!waitingDraft) return;
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingDraft, ideaId]);

  useEffect(() => {
    const drafts = idea?.drafts ?? [];
    if (waitingDraft && drafts.length > 0) setWaitingDraft(false);
  }, [idea, waitingDraft]);

  async function run(label: string, call: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await call();
      setMessage(ok);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!idea) return error ? <ErrorBox message={error} /> : <Loading />;

  const drafts = [...(idea.drafts ?? [])].sort((a, b) => b.version - a.version);
  const latest: Draft | undefined = drafts[0];
  const platformDef = platforms?.find((item) => item.key === idea.platform);
  const formatDef = platformDef?.formatDetails.find((detail) => detail.key === idea.format);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setMessage("Copiado al portapapeles.");
  }

  return (
    <div>
      <Link href="/social/ideas" className="text-sm text-emerald-700 underline">
        ← Volver al calendario
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{idea.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <Badge tone={IDEA_STATUS_TONE[idea.status] ?? "zinc"}>
              {IDEA_STATUS_LABEL[idea.status] ?? idea.status}
            </Badge>
            <Badge tone="zinc">
              {platformDef?.label ?? idea.platform} · {formatDef?.label ?? idea.format}
            </Badge>
            <Badge tone={idea.source === "ia" ? "emerald" : idea.source === "manual" ? "blue" : "amber"}>
              {idea.source === "ia" ? "escrita por IA" : idea.source === "manual" ? "cargada a mano" : "plantilla"}
            </Badge>
            {idea.scheduledFor && <span>{fmtDateTime(idea.scheduledFor)}</span>}
            {idea.publishedUrl && (
              <a href={idea.publishedUrl} target="_blank" rel="noreferrer" className="underline">
                ver publicación
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {idea.status === "IDEA" && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => run("a", () => socialApi.patch(`/ideas/${idea.id}`, { status: "APPROVED" }), "Aprobada.")}
            >
              Aprobar
            </Button>
          )}
          {idea.status !== "PUBLISHED" && (
            <Button onClick={() => setShowPublish((value) => !value)}>Ya publiqué</Button>
          )}
          {idea.status !== "DISCARDED" && idea.status !== "PUBLISHED" && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => run("d", () => socialApi.patch(`/ideas/${idea.id}`, { status: "DISCARDED" }), "Descartada.")}
            >
              Descartar
            </Button>
          )}
        </div>
      </div>

      {showPublish && (
        <Card className="mt-3">
          <SectionTitle hint="el enlace es lo que permite atribuir rendimiento después">
            Marcar como publicada
          </SectionTitle>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <Field label="Enlace (opcional)">
                <Input
                  value={publishedUrl}
                  onChange={(event) => setPublishedUrl(event.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                run(
                  "p",
                  () =>
                    socialApi.post(`/ideas/${idea.id}/published`, {
                      ...(publishedUrl.trim() ? { url: publishedUrl.trim() } : {}),
                    }),
                  "Marcada como publicada.",
                ).then(() => setShowPublish(false))
              }
            >
              Confirmar
            </Button>
          </div>
        </Card>
      )}

      <ErrorBox message={error} />
      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="editable">La idea</SectionTitle>
          <div className="space-y-3">
            <Field label="Título">
              <Input value={ideaForm.title} onChange={(event) => setIdeaForm({ ...ideaForm, title: event.target.value })} />
            </Field>
            <Field label="Gancho">
              <Input value={ideaForm.hook} onChange={(event) => setIdeaForm({ ...ideaForm, hook: event.target.value })} />
            </Field>
            <Field label="Enfoque">
              <Textarea
                rows={5}
                value={ideaForm.angle}
                onChange={(event) => setIdeaForm({ ...ideaForm, angle: event.target.value })}
              />
            </Field>
            <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
              <span className="font-medium">Por qué ahora:</span> {idea.whyNow}
            </div>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => run("e", () => socialApi.patch(`/ideas/${idea.id}`, ideaForm), "Idea actualizada.")}
            >
              Guardar cambios
            </Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle hint="las señales que la sostienen">De dónde salió</SectionTitle>
            {(idea.signals ?? []).length === 0 && (
              <p className="text-sm text-zinc-400">Es una idea cargada a mano: no cuelga de ninguna señal.</p>
            )}
            <ul className="space-y-2">
              {(idea.signals ?? []).map((link) => (
                <li key={link.id} className="border-b border-zinc-100 pb-2 text-sm last:border-0">
                  {link.signal.url ? (
                    <a href={link.signal.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {link.signal.title}
                    </a>
                  ) : (
                    <span>{link.signal.title}</span>
                  )}
                  {link.signal.summary && (
                    <p className="mt-1 text-xs text-zinc-500">{link.signal.summary.slice(0, 240)}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle hint="se escribe solo cuando lo pedís">Borrador</SectionTitle>

            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || waitingDraft}
                onClick={() => {
                  setWaitingDraft(true);
                  void run(
                    "draft",
                    () => socialApi.post(`/ideas/${idea.id}/draft`),
                    "Pidiendo el borrador (una llamada de IA). Aparece en unos segundos.",
                  );
                }}
              >
                {waitingDraft ? "Escribiendo…" : latest ? "Escribir otra versión" : "Escribime un borrador"}
              </Button>
              {latest && (
                <Button variant="secondary" onClick={() => copy(latest.content.caption)}>
                  Copiar el texto
                </Button>
              )}
            </div>

            {!latest && !waitingDraft && (
              <p className="mt-3 text-sm text-zinc-400">
                Sin borrador. El coach no escribe solo: pedilo cuando quieras y quedan las versiones
                anteriores.
              </p>
            )}

            {latest && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <Badge tone="zinc">versión {latest.version}</Badge>
                  {latest.editedByUser && <Badge tone="blue">editado por vos</Badge>}
                  <span>{fmtDate(latest.createdAt)}</span>
                </div>

                {editingDraft === latest.id ? (
                  <div className="space-y-3">
                    <Field label="Texto de la pieza">
                      <Textarea
                        rows={10}
                        value={draftForm.caption}
                        onChange={(event) => setDraftForm({ ...draftForm, caption: event.target.value })}
                      />
                    </Field>
                    <Field label="Guion (para video)">
                      <Textarea
                        rows={6}
                        value={draftForm.script}
                        onChange={(event) => setDraftForm({ ...draftForm, script: event.target.value })}
                      />
                    </Field>
                    <Field label="Llamado a la acción">
                      <Input
                        value={draftForm.cta}
                        onChange={(event) => setDraftForm({ ...draftForm, cta: event.target.value })}
                      />
                    </Field>
                    <Field label="Notas de producción">
                      <Textarea
                        rows={3}
                        value={draftForm.notes}
                        onChange={(event) => setDraftForm({ ...draftForm, notes: event.target.value })}
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          run(
                            "save",
                            () =>
                              socialApi.patch(`/drafts/${latest.id}`, {
                                caption: draftForm.caption,
                                script: draftForm.script,
                                hookVariants: latest.content.hookVariants,
                                cta: draftForm.cta,
                                notes: draftForm.notes,
                              }),
                            "Borrador guardado (queda marcado como editado).",
                          ).then(() => setEditingDraft(null))
                        }
                      >
                        Guardar
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingDraft(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-zinc-200 p-3 text-sm whitespace-pre-wrap">
                      {latest.content.caption}
                    </div>
                    {latest.content.script && (
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm whitespace-pre-wrap">
                        <div className="mb-1 text-xs font-medium text-zinc-500">Guion</div>
                        {latest.content.script}
                      </div>
                    )}
                    {latest.content.hookVariants.length > 0 && (
                      <div className="text-sm text-zinc-600">
                        <div className="text-xs font-medium text-zinc-500">Otros arranques</div>
                        <ul className="mt-1 space-y-1">
                          {latest.content.hookVariants.map((hook) => (
                            <li key={hook}>· {hook}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {latest.content.cta && (
                      <p className="text-sm text-zinc-600">
                        <span className="text-xs font-medium text-zinc-500">Cierre: </span>
                        {latest.content.cta}
                      </p>
                    )}
                    {latest.content.notes && (
                      <p className="text-xs text-zinc-500">Notas: {latest.content.notes}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setDraftForm({
                            caption: latest.content.caption,
                            script: latest.content.script,
                            cta: latest.content.cta,
                            notes: latest.content.notes,
                          });
                          setEditingDraft(latest.id);
                        }}
                      >
                        Editar
                      </Button>
                      {latest.content.script && (
                        <Button variant="ghost" onClick={() => copy(latest.content.script)}>
                          Copiar el guion
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {drafts.length > 1 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-zinc-500">
                      Versiones anteriores ({drafts.length - 1})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {drafts.slice(1).map((draft) => (
                        <li key={draft.id} className="text-xs text-zinc-500">
                          v{draft.version} · {fmtDateTime(draft.createdAt)}
                          {draft.editedByUser && " · editado"} ·{" "}
                          {draft.content.caption.slice(0, 80)}…
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {waitingDraft && (
        <p className="mt-4 text-center text-sm text-zinc-400">El modelo está escribiendo…</p>
      )}
    </div>
  );
}
