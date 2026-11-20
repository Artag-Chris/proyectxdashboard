"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { APPLY_LANGUAGE_OPTIONS, Card } from "@/lib/cv-ui";
import type {
  ApplyLanguage,
  CustomResumeResponse,
  ProfilePdfInfo,
  ProfileRow,
  ResumeDraftContent,
} from "@/lib/cv-types";
import { registerFonts } from "@/lib/pdf/register-fonts";
import { ResumeDocument } from "@/lib/pdf/ResumeDocument";
import {
  portfolioUrl,
  type ResumePdfData,
  type ResumePdfProfile,
} from "@/lib/pdf/types";
import { ResumeEditor } from "@/components/cv/ResumeEditor";

registerFonts();

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[560px] items-center justify-center text-sm text-zinc-400">
        Cargando vista previa PDF…
      </div>
    ),
  },
);

const PRESETS = [
  {
    label: "Full Stack",
    title: "Senior Full Stack Engineer",
    prompt:
      "Enfoca esta HV para una posición Full Stack. Destaca experiencia end-to-end (frontend React/Next.js + backend Node.js/NestJS/TypeScript + bases de datos), arquitectura escalable, despliegue en producción y liderazgo técnico.",
  },
  {
    label: "Backend",
    title: "Senior Backend Engineer",
    prompt:
      "Enfoca esta HV para una posición Backend. Prioriza arquitectura de APIs, microservicios, colas/event-driven (BullMQ, Redis, PostgreSQL), rendimiento, resiliencia, testing y seguridad en producción.",
  },
  {
    label: "AI Engineer",
    title: "AI Engineer · LLMs, RAG & Agents",
    prompt:
      "Enfoca esta HV para una posición de AI Engineer. Destaca sistemas de IA en producción, arquitecturas RAG con pgvector, agentes conversacionales, optimización de costos/caching de LLMs, pipelines event-driven y evaluación.",
  },
  {
    label: "Ciberseguridad",
    title: "Application Security & Backend Engineer",
    prompt:
      "Enfoca esta HV para una posición orientada a ciberseguridad / AppSec. Destaca cifrado de credenciales (AES-256-GCM), autenticación JWT, control de acceso, validación estricta de entradas, mitigación SSRF, hardening de APIs y buenas prácticas de seguridad en infraestructura.",
  },
  {
    label: "Tech Lead",
    title: "Tech Lead · Full Stack & AI",
    prompt:
      "Enfoca esta HV para un rol de Tech Lead. Destaca liderazgo de equipos, decisiones de arquitectura, diseño de sistemas escalables, entrega de productos en producción y mentoría técnica.",
  },
];

function safeFileName(parts: (string | null | undefined)[], ext: string): string {
  const base = parts
    .filter(Boolean)
    .join("_")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${base || "Hoja_de_vida"}.${ext}`;
}

export default function CustomResumePage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profileId, setProfileId] = useState("");
  const [profileInfo, setProfileInfo] = useState<ProfilePdfInfo | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<ApplyLanguage>("auto");
  const [atsMode, setAtsMode] = useState(false);

  const [content, setContent] = useState<ResumeDraftContent | null>(null);
  const [source, setSource] = useState<"ia" | "plantilla" | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // Cargar lista de perfiles y preseleccionar el primario.
  useEffect(() => {
    let alive = true;
    cvApi
      .get<ProfileRow[]>("/profiles")
      .then((list) => {
        if (!alive) return;
        setProfiles(list);
        const primary = list.find((p) => p.isPrimary) ?? list[0];
        if (primary) {
          setProfileId(primary.id);
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "No se pudieron cargar los perfiles");
      });
    return () => {
      alive = false;
    };
  }, []);

  // Cargar datos completos del perfil seleccionado (contacto, links, idiomas) para el PDF.
  useEffect(() => {
    if (!profileId) return;
    let alive = true;
    cvApi
      .get<ProfilePdfInfo>(`/profiles/${profileId}`)
      .then((info) => {
        if (alive) setProfileInfo(info);
      })
      .catch(() => {
        if (alive) setProfileInfo(null);
      });
    return () => {
      alive = false;
    };
  }, [profileId]);

  const qrUrl = profileInfo ? portfolioUrl(profileInfo) : null;
  useEffect(() => {
    let alive = true;
    if (!qrUrl) return () => { alive = false; };
    import("qrcode")
      .then((mod) => mod.toDataURL(qrUrl, { margin: 0, width: 300 }))
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => {
        if (alive) setQr(null);
      });
    return () => {
      alive = false;
    };
  }, [qrUrl]);

  const pdfProfile: ResumePdfProfile = useMemo(
    () => ({
      name: profileInfo?.name ?? "Hoja de vida",
      headline: profileInfo?.headline ?? [],
      email: profileInfo?.email,
      phone: profileInfo?.phone,
      location: profileInfo?.location,
      links: profileInfo?.links ?? [],
      languages: profileInfo?.languages ?? [],
    }),
    [profileInfo],
  );

  const resumeData: ResumePdfData | null = useMemo(() => {
    if (!content) return null;
    return {
      profile: pdfProfile,
      content,
      qrDataUrl: qrUrl ? qr : null,
    };
  }, [pdfProfile, content, qr, qrUrl]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!profileId) return;
    setError("");
    setNote("");
    setBusy(true);
    try {
      const res = await cvApi.post<CustomResumeResponse>(
        `/profiles/${profileId}/custom-resume`,
        {
          title: title.trim() || undefined,
          prompt: prompt.trim(),
          language,
          atsMode,
        },
      );
      setContent(res.content);
      setSource(res.source);
      if (res.note) setNote(res.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando la HV");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefine(instruction: string) {
    if (!profileId || !content) return;
    setError("");
    setNote("");
    setBusy(true);
    try {
      const res = await cvApi.post<CustomResumeResponse>(
        `/profiles/${profileId}/custom-resume`,
        {
          title: title.trim() || undefined,
          prompt: instruction,
          language: content.language ?? language,
          atsMode: Boolean(content.atsMode),
          currentContent: content,
        },
      );
      setContent(res.content);
      setSource(res.source);
      setNote(res.note ?? "HV refinada con IA según tu instrucción.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error refinando la HV");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf() {
    if (!resumeData) return;
    setDownloading(true);
    setError("");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(<ResumeDocument data={resumeData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFileName(
        [
          pdfProfile.name,
          content?.headline || title,
          content?.atsMode ? "ATS" : null,
        ],
        "pdf",
      );
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el PDF");
    } finally {
      setDownloading(false);
    }
  }

  function handleDownloadMarkdown() {
    if (!content) return;
    const md =
      content.markdown ||
      `# ${pdfProfile.name}\n\n## ${content.headline ?? ""}\n\n${content.summary ?? ""}`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeFileName([pdfProfile.name, content.headline || title], "md");
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleAtsMode(next: boolean) {
    setAtsMode(next);
    if (content) {
      setContent({ ...content, atsMode: next || undefined });
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Crear HV a medida por prompt</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Indicale a la IA el rol objetivo y las cualidades que quieres destacar (Full Stack,
          Backend, AI Engineer, Ciberseguridad…). Usa únicamente los hechos verificados de tu
          perfil y te deja editarla y exportarla en PDF al instante.
        </p>
      </div>

      <Card>
        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Presets rápidos */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-zinc-500">
              Plantillas rápidas de enfoque (opcional)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setTitle(p.title);
                    setPrompt(p.prompt);
                  }}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Perfil base</label>
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isPrimary ? " ★" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">
                Título / Rol objetivo
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Senior Full Stack Engineer"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600">Idioma</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as ApplyLanguage)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {APPLY_LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              Prompt / Instrucciones para la IA
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej. Arma esta HV para una posición de Backend Senior enfocada en NestJS, PostgreSQL, colas con Redis y arquitectura de microservicios. Resalta los proyectos en producción y deja primero las skills de backend y cloud."
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
              minLength={5}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={atsMode}
                onChange={(e) => toggleAtsMode(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Modo ATS (una columna, encabezados estándar)</span>
            </label>

            <button
              type="submit"
              disabled={busy || !profileId || prompt.trim().length < 5}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Armando HV con IA…" : content ? "Regenerar HV" : "Generar HV con IA"}
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          {note && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {note}
            </div>
          )}
        </form>
      </Card>

      {content && resumeData && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-800">
                Resultado editable y exportación
              </h2>
              {source && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    source === "ia"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {source === "ia" ? "Generada con IA" : "Plantilla determinística"}
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleAtsMode(!content.atsMode)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                  content.atsMode
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {content.atsMode ? "Modo ATS: ON" : "Modo ATS: OFF"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Descargar .md
              </button>
              <button
                type="button"
                disabled={downloading}
                onClick={handleDownloadPdf}
                className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {downloading
                  ? "Generando PDF…"
                  : content.atsMode
                    ? "Descargar PDF (ATS)"
                    : "Descargar PDF"}
              </button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="max-h-[760px] overflow-y-auto pr-1">
              <ResumeEditor
                content={content}
                onChange={setContent}
                onRefine={handleRefine}
                busy={busy}
              />
            </div>

            <div className="min-h-[600px] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
              <PDFViewer width="100%" height={760} showToolbar>
                <ResumeDocument data={resumeData} />
              </PDFViewer>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
