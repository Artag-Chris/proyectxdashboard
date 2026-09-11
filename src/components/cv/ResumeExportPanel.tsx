"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { Card } from "@/lib/cv-ui";
import type {
  ProfilePdfInfo,
  RefineResponse,
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
import { PdfPreviewModal, type PreviewTab } from "./PdfPreviewModal";

// El motor de PDF toca APIs del navegador: nunca debe renderizarse en el server.
registerFonts();

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center text-sm text-zinc-400">
        Cargando previsualización…
      </div>
    ),
  },
);

interface Props {
  draftId: string;
  /** Perfil dueño del borrador: de ahí salen contacto, idiomas y QR. */
  profileId: string;
  content: ResumeDraftContent;
  vacancyTitle: string;
  company: string | null;
  /** Avisa al padre para que refresque (el contenido ya se guardó). */
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
  content: initialContent,
  vacancyTitle,
  company,
  onChanged,
}: Props) {
  // Copia editable: se persiste al apretar Guardar (o cuando guarda la IA).
  const [content, setContent] = useState<ResumeDraftContent>(initialContent);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialContent));
  const [qr, setQr] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfilePdfInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<PreviewTab>("cv");
  const [open, setOpen] = useState(false);

  // Datos de contacto del perfil (email, teléfono, enlaces, idiomas).
  useEffect(() => {
    let alive = true;
    cvApi
      .get<ProfilePdfInfo>(`/profiles/${profileId}`)
      .then((p) => {
        if (alive) setProfile(p);
      })
      .catch(() => {
        if (alive) setProfile(null);
      });
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

  const resumeData = useMemo(
    () => ({
      content,
      profile: pdfProfile,
      // Sin URL de portafolio el QR queda ausente (no se dibuja el bloque).
      qrDataUrl: qrUrl ? qr : null,
      qrLabel: qrUrl ? prettyUrl(qrUrl) : null,
    }),
    [content, pdfProfile, qr, qrUrl],
  );

  const letterData = useMemo(
    () => ({
      profile: pdfProfile,
      coverLetter: content.coverLetter ?? "",
      company,
      vacancyTitle,
      date: formatLongDate(),
    }),
    [pdfProfile, content.coverLetter, company, vacancyTitle],
  );

  const dirty = JSON.stringify(content) !== savedJson;
  const canRender = !!profile;
  const hasLetter = !!content.coverLetter?.trim();

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      await cvApi.patch(`/resumes/${draftId}`, { content });
      setSavedJson(JSON.stringify(content));
      setMsg("Guardado.");
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
      const res = await cvApi.post<{
        coverLetter: string;
        coverLetterSource: ResumeDraftContent["coverLetterSource"];
      }>(`/resumes/${draftId}/cover-letter`);
      const next: ResumeDraftContent = {
        ...content,
        coverLetter: res.coverLetter,
        coverLetterSource: res.coverLetterSource,
      };
      setContent(next);
      setSavedJson(JSON.stringify(next));
      setMsg(
        res.coverLetterSource === "ia"
          ? "Carta generada con IA. Revisala y editala si hace falta."
          : "Sin proveedor de IA: se usó una carta base. Editala a tu gusto.",
      );
      await onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** La IA reorganiza el boceto completo (el guardado lo hace el servidor). */
  async function refine(instruction: string) {
    setBusy(true);
    setMsg("");
    try {
      const res = await cvApi.post<RefineResponse>(`/resumes/${draftId}/refine`, {
        instruction,
      });
      if (res.applied) {
        setContent(res.content);
        setSavedJson(JSON.stringify(res.content));
        await onChanged();
      }
      setMsg(res.note);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Renderiza el documento en el navegador y dispara la descarga. */
  async function download(kind: PreviewTab) {
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

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-emerald-700">
              Hoja de vida y carta
              {dirty && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  sin guardar
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {qrUrl
                ? `El PDF incluye un QR a ${prettyUrl(qrUrl)}.`
                : "Sin portafolio en el perfil: el PDF saldrá sin QR."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setOpen(true)}
              disabled={!canRender}
              className="rounded-lg border border-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              Editar y previsualizar
            </button>
            <button
              onClick={() => void download(tab)}
              disabled={busy || !canRender}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Descargar PDF
            </button>
          </div>
        </div>

        {msg && <p className="mt-2 text-xs text-emerald-700">{msg}</p>}
        {!canRender && <p className="mt-2 text-xs text-zinc-400">Cargando datos del perfil…</p>}

        <div className="mt-3 flex flex-wrap gap-1">
          {(
            [
              ["cv", "Hoja de vida"],
              ["carta", "Carta de presentación"],
            ] as [PreviewTab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                tab === value
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {label}
              {value === "carta" && hasLetter ? " ✓" : ""}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
          {canRender ? (
            // El visor se omite mientras el modal está abierto: evita dos
            // instancias del motor de PDF renderizando a la vez.
            open ? (
              <div className="flex h-[420px] items-center justify-center text-sm text-zinc-400">
                Editando en la ventana ampliada…
              </div>
            ) : (
              <PDFViewer width="100%" height={420} showToolbar={false}>
                {tab === "cv" ? (
                  <ResumeDocument data={resumeData} />
                ) : (
                  <CoverLetterDocument data={letterData} />
                )}
              </PDFViewer>
            )
          ) : (
            <div className="flex h-[420px] items-center justify-center text-sm text-zinc-400">
              Preparando vista previa…
            </div>
          )}
        </div>

        {tab === "carta" && (
          <button
            onClick={() => void generateLetter()}
            disabled={busy || !canRender}
            className="mt-2 rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            {hasLetter ? "Regenerar carta con IA" : "Generar carta con IA"}
          </button>
        )}
      </Card>

      <PdfPreviewModal
        open={open}
        onClose={() => setOpen(false)}
        tab={tab}
        onTab={setTab}
        content={content}
        onChange={setContent}
        onRefine={refine}
        resumeData={resumeData}
        letterData={letterData}
        onDownload={download}
        onSave={save}
        onGenerateLetter={generateLetter}
        busy={busy}
        msg={msg}
        dirty={dirty}
      />
    </>
  );
}
