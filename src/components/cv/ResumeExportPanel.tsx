"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { Card } from "@/lib/cv-ui";
import type {
  CoverLetterResponse,
  ProfilePdfInfo,
  ResumeDraftContent,
} from "@/lib/cv-types";
import { registerFonts } from "@/lib/pdf/register-fonts";
import { CoverLetterDocument } from "@/lib/pdf/CoverLetterDocument";
import { ResumeDocument } from "@/lib/pdf/ResumeDocument";
import {
  formatLongDate,
  portfolioUrl,
  prettyUrl,
  type ResumePdfProfile,
} from "@/lib/pdf/types";

// El motor de PDF toca APIs del navegador: nunca debe renderizarse en el server.
registerFonts();

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center text-sm text-zinc-400">
        Cargando previsualización…
      </div>
    ),
  },
);

type Tab = "cv" | "carta";

interface Props {
  draftId: string;
  /** Datos de contacto del perfil (se piden aparte: el detalle no los trae). */
  profileId: string;
  content: ResumeDraftContent;
  vacancyTitle: string;
  company: string | null;
  /** Cambia cuando el borrador se regenera: refresca el borrador local. */
  onChanged: () => void | Promise<void>;
}

/** Nombre de archivo seguro para la descarga. */
function fileName(parts: (string | null | undefined)[], fallback: string): string {
  const base = parts
    .filter(Boolean)
    .join("_")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${base || fallback}.pdf`;
}

export function ResumeExportPanel({
  draftId,
  profileId,
  content,
  vacancyTitle,
  company,
  onChanged,
}: Props) {
  const [tab, setTab] = useState<Tab>("cv");
  const [summary, setSummary] = useState(content.summary ?? "");
  const [letter, setLetter] = useState(content.coverLetter ?? "");
  const [qr, setQr] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePdfInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Datos de contacto del perfil (email, teléfono, enlaces, idiomas).
  useEffect(() => {
    let alive = true;
    cvApi
      .get<ProfilePdfInfo>(`/profiles/${profileId}`)
      .then((p) => alive && setProfile(p))
      .catch(() => alive && setProfile(null));
    return () => {
      alive = false;
    };
  }, [profileId]);

  const qrUrl = profile ? portfolioUrl(profile) : null;

  // El QR se dibuja en el cliente (librería `qrcode`) y se incrusta como PNG.
  // Sin URL de portafolio no se dibuja nada: el ausente se deriva, no se
  // sincroniza con setState dentro del efecto.
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
      name: profile?.name ?? "Hoja de vida",
      headline: profile?.headline ?? [],
      email: profile?.email,
      phone: profile?.phone,
      location: profile?.location,
      links: profile?.links ?? [],
      languages: profile?.languages ?? [],
    }),
    [profile],
  );

  // El resumen editado se refleja en la vista previa al instante (aún sin guardar).
  const pdfContent = useMemo(
    () => ({ ...content, summary: summary || content.summary }),
    [content, summary],
  );

  const resumeData = useMemo(
    () => ({
      content: pdfContent,
      profile: pdfProfile,
      // Sin URL de portafolio el QR queda ausente (no se dibuja el bloque).
      qrDataUrl: qrUrl ? qr : null,
      qrLabel: qrUrl ? prettyUrl(qrUrl) : null,
    }),
    [pdfContent, pdfProfile, qr, qrUrl],
  );

  const letterData = useMemo(
    () => ({
      profile: pdfProfile,
      coverLetter: letter,
      company,
      vacancyTitle,
      date: formatLongDate(),
    }),
    [pdfProfile, letter, company, vacancyTitle],
  );

  /** Guarda el resumen editado y re-indexa el borrador. */
  async function saveSummary() {
    if (!profile) return;
    setBusy(true);
    setMsg("");
    try {
      await cvApi.patch(`/resumes/${draftId}`, { content: { ...content, summary } });
      setMsg("Resumen guardado — la vista previa ya lo refleja.");
      await onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function generateLetter() {
    setBusy(true);
    setMsg("");
    try {
      const res = await cvApi.post<CoverLetterResponse>(`/resumes/${draftId}/cover-letter`);
      setLetter(res.coverLetter);
      setMsg(
        res.coverLetterSource === "ia"
          ? "Carta generada con IA. Revisala y editala antes de descargar."
          : "El proveedor de IA no está configurado: se usó una carta base. Editala a tu gusto.",
      );
      await onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveLetter() {
    setBusy(true);
    setMsg("");
    try {
      const res = await cvApi.patch<CoverLetterResponse>(`/resumes/${draftId}/cover-letter`, {
        coverLetter: letter,
      });
      setLetter(res.coverLetter);
      setMsg("Carta guardada.");
      await onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Renderiza el documento en el navegador y dispara la descarga. */
  async function download(kind: Tab) {
    setBusy(true);
    setMsg("");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const document =
        kind === "cv" ? (
          <ResumeDocument data={resumeData} />
        ) : (
          <CoverLetterDocument data={letterData} />
        );
      const blob = await pdf(document).toBlob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download =
        kind === "cv"
          ? fileName([pdfProfile.name, company ?? vacancyTitle], "Hoja_de_vida")
          : fileName(["Carta", pdfProfile.name, company], "Carta_de_presentacion");
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      // Libera el blob para no retener memoria.
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMsg(kind === "cv" ? "Hoja de vida descargada." : "Carta descargada.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const canRender = !!profile;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(
            [
              ["cv", "Hoja de vida"],
              ["carta", "Carta de presentación"],
            ] as [Tab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === value
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {label}
              {value === "carta" && letter ? " ✓" : ""}
            </button>
          ))}
        </div>
        <button
          onClick={() => void download(tab)}
          disabled={busy || !canRender}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Descargar {tab === "cv" ? "hoja de vida" : "carta"} (PDF)
        </button>
      </div>

      {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
      {!canRender && (
        <p className="mt-2 text-xs text-zinc-400">Cargando datos del perfil…</p>
      )}

      {tab === "cv" ? (
        <div className="mt-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Resumen (editable — se refleja en el PDF)
          </label>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={() => void saveSummary()}
              disabled={busy || !canRender}
              className="rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              Guardar resumen
            </button>
            {qrUrl ? (
              <span className="text-xs text-zinc-400">
                El PDF incluye un QR a {prettyUrl(qrUrl)}
              </span>
            ) : (
              <span className="text-xs text-amber-600">
                Sin portafolio en el perfil: el PDF saldrá sin QR.
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void generateLetter()}
              disabled={busy || !canRender}
              className="rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {letter ? "Regenerar con IA" : "Generar carta con IA"}
            </button>
            {letter && (
              <button
                onClick={() => void saveLetter()}
                disabled={busy}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
              >
                Guardar cambios
              </button>
            )}
            {content.coverLetterSource && (
              <span className="text-xs text-zinc-400">
                Fuente: {content.coverLetterSource}
                {content.coverLetterUpdatedAt
                  ? ` · ${new Date(content.coverLetterUpdatedAt).toLocaleDateString()}`
                  : ""}
              </span>
            )}
          </div>
          <textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            rows={12}
            placeholder="Generá la carta con IA o escribila acá. Separá los párrafos con una línea vacía."
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
        {canRender ? (
          <PDFViewer width="100%" height={560} showToolbar={false}>
            {tab === "cv" ? (
              <ResumeDocument data={resumeData} />
            ) : (
              <CoverLetterDocument data={letterData} />
            )}
          </PDFViewer>
        ) : (
          <div className="flex h-[560px] items-center justify-center text-sm text-zinc-400">
            Preparando vista previa…
          </div>
        )}
      </div>
    </Card>
  );
}
