"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { CoverLetterPdfData, ResumePdfData } from "@/lib/pdf/types";
import { CoverLetterDocument } from "@/lib/pdf/CoverLetterDocument";
import { ResumeDocument } from "@/lib/pdf/ResumeDocument";
import { registerFonts } from "@/lib/pdf/register-fonts";
import { ResumeEditor } from "./ResumeEditor";
import type { ResumeDraftContent } from "@/lib/cv-types";

registerFonts();

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400">
        Cargando previsualización…
      </div>
    ),
  },
);

export type PreviewTab = "cv" | "carta";

interface Props {
  open: boolean;
  onClose: () => void;
  tab: PreviewTab;
  onTab: (tab: PreviewTab) => void;
  /** Contenido editable de la HV (incluye la carta) — el editor escribe acá. */
  content: ResumeDraftContent;
  onChange: (next: ResumeDraftContent) => void;
  onRefine: (instruction: string) => void | Promise<void>;
  resumeData: ResumePdfData;
  letterData: CoverLetterPdfData;
  onDownload: (kind: PreviewTab) => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onGenerateLetter: () => void | Promise<void>;
  busy: boolean;
  msg: string;
  dirty: boolean;
}

/**
 * Vista previa en pop-out con edición al lado: se edita a la izquierda y el PDF
 * se re-renderiza a la derecha con cada cambio (antes de guardar).
 */
export function PdfPreviewModal({
  open,
  onClose,
  tab,
  onTab,
  content,
  onChange,
  onRefine,
  resumeData,
  letterData,
  onDownload,
  onSave,
  onGenerateLetter,
  busy,
  msg,
  dirty,
}: Props) {
  // Cerrar con Escape y bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/70 p-2 sm:p-4">
      <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl bg-zinc-50 shadow-2xl">
        {/* Barra superior */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2">
          <div className="flex gap-1">
            {(
              [
                ["cv", "Hoja de vida"],
                ["carta", "Carta de presentación"],
              ] as [PreviewTab, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => onTab(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  tab === value
                    ? "bg-emerald-600 text-white"
                    : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {msg && <span className="text-xs text-emerald-700">{msg}</span>}
            {dirty && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                sin guardar
              </span>
            )}
            <button
              onClick={() => void onSave()}
              disabled={busy}
              className="rounded-lg border border-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              onClick={() => void onDownload(tab)}
              disabled={busy}
              title={
                content.atsMode
                  ? "Descarga la HV en Modo ATS: una columna y encabezados estándar"
                  : "Descarga la HV en la plantilla de dos columnas"
              }
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {content.atsMode ? "Descargar PDF (ATS)" : "Descargar PDF"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Editor + vista previa */}
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(360px,42%)_1fr]">
          <div className="min-h-0 overflow-auto border-b border-zinc-200 bg-zinc-50 p-3 lg:border-b-0 lg:border-r">
            {tab === "cv" ? (
              <ResumeEditor
                content={content}
                onChange={onChange}
                onRefine={onRefine}
                busy={busy}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void onGenerateLetter()}
                    disabled={busy}
                    className="rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {content.coverLetter ? "Regenerar con IA" : "Generar carta con IA"}
                  </button>
                </div>
                <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Texto de la carta (editable)
                </label>
                <textarea
                  value={content.coverLetter ?? ""}
                  onChange={(e) => onChange({ ...content, coverLetter: e.target.value })}
                  rows={26}
                  placeholder="Generá la carta con IA o escribila acá. Separá los párrafos con una línea vacía."
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {content.coverLetterSource && (
                  <p className="text-[11px] text-zinc-400">
                    Fuente: {content.coverLetterSource}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 bg-zinc-200">
            <PDFViewer width="100%" height="100%" showToolbar={false}>
              {tab === "cv" ? (
                <ResumeDocument data={resumeData} />
              ) : (
                <CoverLetterDocument data={letterData} />
              )}
            </PDFViewer>
          </div>
        </div>
      </div>
    </div>
  );
}
