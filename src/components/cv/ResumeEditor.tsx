"use client";

import { useState } from "react";
import type {
  ResumeDraftContent,
  ResumeExperienceItem,
  ResumeProjectItem,
  ResumeEducationItem,
} from "@/lib/cv-types";

interface EditorProps {
  content: ResumeDraftContent;
  onChange: (next: ResumeDraftContent) => void;
  onRefine: (instruction: string) => void | Promise<void>;
  busy: boolean;
}

const INPUT =
  "w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";
const LABEL = "block text-[11px] font-semibold uppercase tracking-wide text-zinc-400";

/** Botones para reordenar/quitar un bloque dentro de una lista. */
function RowActions({
  index,
  total,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const btn =
    "rounded border border-zinc-300 px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30";
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        className={btn}
        title="Subir"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={btn}
        title="Bajar"
        disabled={index === total - 1}
        onClick={() => onMove(index, index + 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className="rounded border border-red-200 px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50"
        title="Quitar"
        onClick={() => onRemove(index)}
      >
        ×
      </button>
    </div>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** Lista simple de textos (skills, soft skills). */
function StringList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((value, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            className={INPUT}
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <RowActions
            index={i}
            total={items.length}
            onMove={(from, to) => onChange(move(items, from, to))}
            onRemove={(idx) => onChange(items.filter((_, j) => j !== idx))}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="self-start rounded-lg border border-dashed border-emerald-400 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
      >
        + Agregar
      </button>
    </div>
  );
}

/** Sección plegable: mantiene el editor corto y navegable. */
function Section({
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-sm font-semibold text-emerald-700">{title}</span>
        <span className="text-xs text-zinc-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-100 px-3 py-3">
          {hint && <p className="mb-2 text-xs text-zinc-400">{hint}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

export function ResumeEditor({ content, onChange, onRefine, busy }: EditorProps) {
  const [instruction, setInstruction] = useState("");
  const skills = content.skills ?? [];
  const softSkills = content.softSkills ?? [];
  const experience = content.experience ?? [];
  const projects = content.projects ?? [];
  const education = content.education ?? [];

  const patch = (next: Partial<ResumeDraftContent>) => onChange({ ...content, ...next });

  function updateItem<T>(list: T[], index: number, value: T): T[] {
    const next = [...list];
    next[index] = value;
    return next;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Asistente: la IA reorganiza el boceto completo. */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
        <div className={LABEL}>Asistente IA</div>
        <p className="mt-1 text-xs text-zinc-500">
          Pedile que reorganice el boceto. Respeta tus datos: no inventa experiencia ni tecnologías.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            className={INPUT}
            value={instruction}
            placeholder="Ej: hazlo más corto y enfócalo a IA"
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && instruction.trim()) {
                void onRefine(instruction);
              }
            }}
          />
          <button
            type="button"
            disabled={busy || !instruction.trim()}
            onClick={() => void onRefine(instruction)}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Organizar
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "Hazlo más conciso",
            "Reordena por impacto",
            "Destaca logros medibles",
            "Enfócalo a IA / LLMs",
            "Tono más formal",
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              onClick={() => {
                setInstruction(chip);
                void onRefine(chip);
              }}
              className="rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <Section title="Titular y resumen" defaultOpen>
        <label className={LABEL}>Titular</label>
        <input
          className={`${INPUT} mt-1`}
          value={content.headline ?? ""}
          placeholder="AI Engineer — Backend"
          onChange={(e) => patch({ headline: e.target.value })}
        />
        <label className={`${LABEL} mt-3`}>Resumen (perfil)</label>
        <textarea
          className={`${INPUT} mt-1`}
          rows={6}
          value={content.summary ?? ""}
          placeholder="3-4 líneas enfocadas en la vacante"
          onChange={(e) => patch({ summary: e.target.value })}
        />
        <p className="mt-1 text-[11px] text-zinc-400">
          Separá en párrafos con una línea vacía.
        </p>
      </Section>

      <Section title={`Experiencia (${experience.length})`} hint="Cada viñeta es un logro concreto.">
        {experience.map((exp, i) => (
          <div key={i} className="mb-3 rounded-lg border border-zinc-200 p-2.5">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3">
                <input
                  className={INPUT}
                  value={exp.role ?? ""}
                  placeholder="Cargo"
                  onChange={(e) =>
                    patch({ experience: updateItem(experience, i, { ...exp, role: e.target.value }) })
                  }
                />
                <input
                  className={INPUT}
                  value={exp.company ?? ""}
                  placeholder="Empresa"
                  onChange={(e) =>
                    patch({
                      experience: updateItem<ResumeExperienceItem>(experience, i, {
                        ...exp,
                        company: e.target.value,
                      }),
                    })
                  }
                />
                <input
                  className={INPUT}
                  value={exp.period ?? ""}
                  placeholder="2024 - Presente"
                  onChange={(e) =>
                    patch({ experience: updateItem(experience, i, { ...exp, period: e.target.value }) })
                  }
                />
              </div>
              <RowActions
                index={i}
                total={experience.length}
                onMove={(from, to) => patch({ experience: move(experience, from, to) })}
                onRemove={(idx) => patch({ experience: experience.filter((_, j) => j !== idx) })}
              />
            </div>
            <label className={`${LABEL} mt-2`}>Logros</label>
            <div className="mt-1">
              <StringList
                items={exp.bullets ?? []}
                placeholder="Escribí el logro…"
                onChange={(bullets) =>
                  patch({ experience: updateItem(experience, i, { ...exp, bullets }) })
                }
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => patch({ experience: [...experience, { role: "", company: "", period: "", bullets: [] }] })}
          className="rounded-lg border border-dashed border-emerald-400 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + Agregar experiencia
        </button>
      </Section>

      <Section title={`Proyectos (${projects.length})`} hint="Se imprimen como casos de estudio, con sus viñetas.">
        {projects.map((project, i) => (
          <div key={i} className="mb-3 rounded-lg border border-zinc-200 p-2.5">
            <div className="flex items-start gap-2">
              <input
                className={INPUT}
                value={project.name ?? ""}
                placeholder="Nombre del proyecto"
                onChange={(e) =>
                  patch({
                    projects: updateItem<ResumeProjectItem>(projects, i, { ...project, name: e.target.value }),
                  })
                }
              />
              <RowActions
                index={i}
                total={projects.length}
                onMove={(from, to) => patch({ projects: move(projects, from, to) })}
                onRemove={(idx) => patch({ projects: projects.filter((_, j) => j !== idx) })}
              />
            </div>
            <div className="mt-2">
              <StringList
                items={project.highlights ?? []}
                placeholder="Qué hiciste y con qué impacto…"
                onChange={(highlights) =>
                  patch({ projects: updateItem(projects, i, { ...project, highlights }) })
                }
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => patch({ projects: [...projects, { name: "", highlights: [] }] })}
          className="rounded-lg border border-dashed border-emerald-400 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + Agregar proyecto
        </button>
      </Section>

      <Section title={`Habilidades técnicas (${skills.length})`} hint="Se imprimen en dos columnas.">
        <StringList
          items={skills}
          placeholder="Ej: NestJS"
          onChange={(next) => patch({ skills: next })}
        />
      </Section>

      <Section title={`Soft skills (${softSkills.length})`}>
        <StringList
          items={softSkills}
          placeholder="Ej: Liderazgo técnico"
          onChange={(next) => patch({ softSkills: next })}
        />
      </Section>

      <Section title={`Formación (${education.length})`}>
        {education.map((edu, i) => (
          <div key={i} className="mb-3 flex items-start gap-2">
            <div className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3">
              <input
                className={INPUT}
                value={edu.degree ?? ""}
                placeholder="Título"
                onChange={(e) =>
                  patch({
                    education: updateItem<ResumeEducationItem>(education, i, { ...edu, degree: e.target.value }),
                  })
                }
              />
              <input
                className={INPUT}
                value={edu.institution ?? ""}
                placeholder="Institución"
                onChange={(e) =>
                  patch({ education: updateItem(education, i, { ...edu, institution: e.target.value }) })
                }
              />
              <input
                className={INPUT}
                value={edu.period ?? ""}
                placeholder="2023 - Presente"
                onChange={(e) =>
                  patch({ education: updateItem(education, i, { ...edu, period: e.target.value }) })
                }
              />
            </div>
            <RowActions
              index={i}
              total={education.length}
              onMove={(from, to) => patch({ education: move(education, from, to) })}
              onRemove={(idx) => patch({ education: education.filter((_, j) => j !== idx) })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            patch({ education: [...education, { institution: "", degree: "", period: "" }] })
          }
          className="rounded-lg border border-dashed border-emerald-400 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
        >
          + Agregar formación
        </button>
      </Section>
    </div>
  );
}
