"use client";

import { useEffect, useRef, useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { Card } from "@/lib/cv-ui";
import type {
  InterviewPrep,
  InterviewPrepContent,
  VacancyDetail,
} from "@/lib/cv-types";

interface Props {
  vacancyId: string;
  /** Perfil de la ficha (vacío si no se eligió uno y hay varios). */
  profileId: string;
  prep: InterviewPrep | null;
  vacancyTitle: string;
  company: string | null;
  onChanged: () => void | Promise<void>;
}

const SOURCE_LABEL: Record<string, string> = {
  ia: "generado con IA",
  plantilla: "plan base (sin proveedor de IA)",
  editada: "editado a mano",
};

const POLL_MS = 4000;
/** ~3 min de espera antes de rendirse con un mensaje honesto. */
const MAX_ATTEMPTS = 45;

function Section({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 rounded-lg border border-zinc-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-sm font-semibold text-zinc-700">{title}</span>
        <span className="flex flex-wrap items-center gap-2">
          {hint && <span className="text-xs text-zinc-400">{hint}</span>}
          <span className="text-xs text-zinc-400">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && <div className="border-t border-zinc-100 px-3 py-3">{children}</div>}
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-zinc-600">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Módulo de preparación de entrevista. Solo se muestra en vacantes aplicadas.
 * Genera el plan a pedido y permite editarlo/avanzar por checkboxes, guardando
 * contra el backend con debounce.
 */
export function InterviewPrepPanel({
  vacancyId,
  profileId,
  prep,
  vacancyTitle,
  company,
  onChanged,
}: Props) {
  const [content, setContent] = useState<InterviewPrepContent | null>(prep?.content ?? null);
  const [syncedVersion, setSyncedVersion] = useState<number | undefined>(prep?.version);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attempts = useRef(0);
  // El callback del padre cambia de identidad en cada render: se guarda en un
  // ref para que el polling no se reinicie (y no se estanque) en cada refresco.
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  // Si el servidor publica una versión nueva (regeneración), se adopta el texto
  // salvo que haya ediciones locales sin guardar.
  if (prep && prep.version !== syncedVersion) {
    setSyncedVersion(prep.version);
    if (!dirty) setContent(prep.content);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // La generación corre en segundo plano (cola): se sondea la ficha hasta que
  // aparece el plan, y recién ahí se avisa al padre.
  useEffect(() => {
    if (!generating) return;
    let alive = true;
    const tick = async () => {
      if (attempts.current >= MAX_ATTEMPTS) {
        if (alive) {
          setGenerating(false);
          setError("La generación está tardando más de lo esperado. Probá regenerar en un rato.");
        }
        return;
      }
      attempts.current += 1;
      try {
        const query = profileId ? `?profileId=${profileId}` : "";
        const v = await cvApi.get<VacancyDetail>(`/vacancies/${vacancyId}${query}`);
        const found = profileId
          ? (v.profiles.find((p) => p.profileId === profileId)?.interview ?? v.interview)
          : v.interview;
        if (found && alive) {
          setGenerating(false);
          setMsg("¡Listo! Revisá el plan y marcá tu avance.");
          await onChangedRef.current();
        }
      } catch {
        // Un fallo de red transitorio no corta la espera.
      }
    };
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [generating, vacancyId, profileId]);

  async function generate(regenerate: boolean) {
    if (
      regenerate &&
      !window.confirm(
        "Se vuelve a redactar el plan con el perfil actual: tu avance (checkboxes) se conserva, pero el texto se reescribe. ¿Seguir?",
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    setError("");
    try {
      const query = profileId ? `?profileId=${profileId}` : "";
      await cvApi.post(`/vacancies/${vacancyId}/interview-prep${query}`);
      attempts.current = 0;
      setGenerating(true);
      setMsg("Generando tu plan de preparación… puede tardar unos segundos.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function persist(next: InterviewPrepContent) {
    if (!prep) return;
    setSaving(true);
    try {
      await cvApi.patch(`/interview-prep/${prep.id}`, { content: next });
      setDirty(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  /** Cambia el contenido local y programa el guardado (debounce). */
  function update(mutator: (draft: InterviewPrepContent) => InterviewPrepContent) {
    if (!content) return;
    const next = mutator(content);
    setContent(next);
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(next), 800);
  }

  function patchItem(
    key: "studyPlan" | "likelyQuestions" | "trickyQuestions" | "checklist",
    index: number,
    patch: Record<string, unknown>,
  ) {
    update((d) => {
      const list = (d[key] as unknown[] | undefined) ?? [];
      const next = list.map((item, i) =>
        i === index ? { ...(item as object), ...patch } : item,
      );
      return { ...d, [key]: next } as InterviewPrepContent;
    });
  }

  // Sin plan todavía: la invitación a generarlo.
  if (!prep || !content) {
    return (
      <Card>
        <h2 className="text-sm font-semibold text-emerald-700">Prepararme para la entrevista</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Generá un plan de estudio y repaso para <b>{vacancyTitle}</b>
          {company ? ` en ${company}` : ""}: qué priorizar, preguntas probables, preguntas
          capciosas y cómo responderlas, y un checklist para llegar preparado.
        </p>
        <button
          onClick={() => void generate(false)}
          disabled={busy || generating}
          className="mt-3 rounded-lg bg-emerald-600 px-3 py-2.5 sm:py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {generating ? "Generando…" : "Prepararme para la entrevista"}
        </button>
        {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
        {generating && (
          <p className="mt-1 text-xs text-zinc-400">
            Podés seguir navegando: el plan aparece cuando termina.
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </Card>
    );
  }

  const studyPlan = content.studyPlan ?? [];
  const likelyQuestions = content.likelyQuestions ?? [];
  const trickyQuestions = content.trickyQuestions ?? [];
  const checklist = content.checklist ?? [];
  const doneCount = studyPlan.filter((t) => t.done).length;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-emerald-700">Preparación de la entrevista</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            {SOURCE_LABEL[prep.source] ?? prep.source} · {vacancyTitle}
            {company ? ` — ${company}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400">
            {saving ? "Guardando…" : dirty ? "Cambios sin guardar" : "Guardado"}
          </span>
          <button
            onClick={() => void generate(true)}
            disabled={busy || generating}
            className="rounded-lg border border-emerald-300 px-3 py-2.5 sm:py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {generating ? "Generando…" : "Regenerar plan"}
          </button>
        </div>
      </div>

      {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <Section title="Resumen y focos" defaultOpen>
        <textarea
          value={content.summary ?? ""}
          onChange={(e) => update((d) => ({ ...d, summary: e.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-zinc-300 px-2 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:py-1.5 sm:text-sm"
        />
        <ListBlock title="Qué priorizar" items={content.focusAreas} />
      </Section>

      <Section title="Plan de estudio y repaso" hint={`${doneCount}/${studyPlan.length}`}>
        {studyPlan.length === 0 && <p className="text-sm text-zinc-400">Sin temas.</p>}
        <div className="flex flex-col gap-3">
          {studyPlan.map((topic, i) => (
            <div key={i} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={topic.done === true}
                  onChange={(e) => patchItem("studyPlan", i, { done: e.target.checked })}
                  className="mt-0.5 h-5 w-5"
                />
                <span
                  className={`text-sm font-medium ${
                    topic.done ? "text-zinc-400 line-through" : "text-zinc-700"
                  }`}
                >
                  {topic.topic}
                </span>
              </label>
              {topic.why && <p className="mt-1 ml-6 text-xs text-zinc-500">{topic.why}</p>}
              {topic.resources && topic.resources.length > 0 && (
                <ul className="mt-1 ml-6 list-disc space-y-0.5 pl-4 text-xs text-zinc-500">
                  {topic.resources.map((r, j) => (
                    <li key={j}>{r}</li>
                  ))}
                </ul>
              )}
              <textarea
                value={topic.practice ?? ""}
                onChange={(e) => patchItem("studyPlan", i, { practice: e.target.value })}
                rows={2}
                placeholder="Práctica / notas"
                className="mt-2 ml-6 w-[calc(100%-1.5rem)] rounded-lg border border-zinc-200 px-2 py-2.5 sm:py-1.5 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Preguntas probables" hint={`${likelyQuestions.length}`}>
        <div className="flex flex-col gap-3">
          {likelyQuestions.map((q, i) => (
            <div key={i} className="rounded-lg border border-zinc-100 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {q.category && (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700">
                    {q.category}
                  </span>
                )}
                <span className="text-sm font-medium text-zinc-700">{q.question}</span>
              </div>
              <textarea
                value={q.answerOutline ?? ""}
                onChange={(e) => patchItem("likelyQuestions", i, { answerOutline: e.target.value })}
                rows={2}
                placeholder="Cómo estructurar tu respuesta"
                className="mt-2 w-full rounded-lg border border-zinc-200 px-2 py-2.5 sm:py-1.5 text-base sm:text-xs text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Preguntas capciosas" hint={`${trickyQuestions.length}`}>
        <div className="flex flex-col gap-3">
          {trickyQuestions.map((q, i) => (
            <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-zinc-700">{q.question}</p>
              {q.whyTricky && (
                <p className="mt-1 text-xs text-amber-800">
                  <b>Por qué es trampa:</b> {q.whyTricky}
                </p>
              )}
              <textarea
                value={q.howToAnswer ?? ""}
                onChange={(e) => patchItem("trickyQuestions", i, { howToAnswer: e.target.value })}
                rows={2}
                placeholder="Cómo responderla"
                className="mt-2 w-full rounded-lg border border-amber-200 px-2 py-2.5 sm:py-1.5 text-base sm:text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Preguntas para el entrevistador y banderas rojas">
        <ListBlock title="Preguntale al entrevistador" items={content.questionsToAsk} />
        {content.redFlags && content.redFlags.length > 0 && (
          <div className="mt-1">
            <ListBlock title="Banderas rojas de la oferta" items={content.redFlags} />
          </div>
        )}
      </Section>

      <Section title="Checklist antes de la entrevista" defaultOpen>
        {checklist.length === 0 && <p className="text-sm text-zinc-400">Sin ítems.</p>}
        <div className="flex flex-col gap-2">
          {checklist.map((item, i) => (
            <label key={i} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={(e) => patchItem("checklist", i, { done: e.target.checked })}
                className="mt-0.5 h-5 w-5"
              />
              <span
                className={`text-sm ${item.done ? "text-zinc-400 line-through" : "text-zinc-600"}`}
              >
                {item.item}
              </span>
            </label>
          ))}
        </div>
      </Section>
    </Card>
  );
}
