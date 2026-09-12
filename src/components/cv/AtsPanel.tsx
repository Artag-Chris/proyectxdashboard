"use client";

import { useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { Card } from "@/lib/cv-ui";
import type { AtsAnalysis, AtsKeywordFix, ResumeDraftContent } from "@/lib/cv-types";
import { resumeToAtsText } from "@/lib/pdf/types";

interface Props {
  draftId: string;
  /** Contenido actual, incluido lo que todavía no se guardó. */
  content: ResumeDraftContent;
  onContent: (next: ResumeDraftContent) => void;
  /** Persiste un cambio puntual (el interruptor del modo se guarda solo). */
  onPersist: (next: ResumeDraftContent) => void | Promise<void>;
  busy: boolean;
  /** Lo calcula el panel padre, para que el badge y esta pestaña coincidan. */
  analysis: AtsAnalysis | null;
  loading: boolean;
  error: string;
  /** Hay cambios locales sin guardar (los acomodos de la IA no se guardan solos). */
  dirty: boolean;
  onSave: () => void | Promise<void>;
  /** Descarga la HV actual; con el Modo ATS encendido sale la de una columna. */
  onDownload: () => void | Promise<void>;
}

const GRADE_STYLE: Record<AtsAnalysis["grade"], { label: string; box: string; text: string }> = {
  PASS: { label: "Pasa el filtro", box: "border-green-200 bg-green-50", text: "text-green-700" },
  RISK: { label: "En riesgo", box: "border-amber-200 bg-amber-50", text: "text-amber-700" },
  FAIL: { label: "No pasa", box: "border-red-200 bg-red-50", text: "text-red-700" },
};

function barColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-amber-500";
  return "bg-red-400";
}

/**
 * Medidor de ATS. El score es determinístico (lo calcula el API, sin IA) sobre
 * el contenido actual —incluidas las ediciones sin guardar— para que mida
 * exactamente lo que se va a exportar.
 */
export function AtsPanel({
  draftId,
  content,
  onContent,
  onPersist,
  busy,
  analysis,
  loading,
  error,
  dirty,
  onSave,
  onDownload,
}: Props) {
  const [fixMsg, setFixMsg] = useState("");
  const [fixing, setFixing] = useState(false);
  const [showText, setShowText] = useState(false);

  const atsMode = content.atsMode === true;
  const grade = analysis ? GRADE_STYLE[analysis.grade] : null;

  function toggleMode() {
    const next = { ...content, atsMode: !atsMode };
    onContent(next);
    void onPersist(next);
  }

  /** Pide a la IA que integre las faltantes; NO guarda, se revisa y se guarda. */
  async function fixKeywords() {
    setFixMsg("");
    setFixing(true);
    try {
      const res = await cvApi.post<AtsKeywordFix>(`/resumes/${draftId}/ats/keywords`, {
        content,
      });
      if (res.applied) onContent(res.content);
      setFixMsg(res.note);
    } catch (e) {
      setFixMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setFixing(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-emerald-700">Medidor de ATS</h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Mide lo que un ATS puede leer: palabras clave, estructura, contacto y formato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-zinc-400">Analizando…</span>}
          {grade && analysis && (
            <div className={`rounded-xl border px-3 py-2 text-center ${grade.box}`}>
              <div className={`text-2xl font-bold ${grade.text}`}>{analysis.score}</div>
              <div className={`text-xs font-medium ${grade.text}`}>{grade.label}</div>
            </div>
          )}
        </div>
      </div>

      {/* Interruptor del modo: es la palanca más grande del score. */}
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <input
          type="checkbox"
          checked={atsMode}
          onChange={toggleMode}
          disabled={busy}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="block text-sm font-medium text-zinc-700">Modo ATS</span>
          <span className="block text-xs text-zinc-500">
            Una columna, encabezados estándar y contacto limpio. Queda menos parecido a tu CV de dos
            columnas, pero mucho más fácil de leer para el robot.
          </span>
        </span>
      </label>

      {/* Con el modo encendido, el PDF que se descarga es el de una columna. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onDownload()}
          disabled={busy || !atsMode}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          Descargar en Modo ATS
        </button>
        <span className="text-xs text-zinc-400">
          {atsMode
            ? "Una columna y encabezados estándar: es la versión que lee el robot."
            : "Activá el Modo ATS para bajar la versión de una columna."}
        </span>
      </div>

      {/*
        «Acomodarlas con IA» cambia el borrador en pantalla pero NO lo guarda: sin
        este aviso, el trabajo de la IA se perdía al salir de la ficha.
      */}
      {dirty && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <span className="text-xs text-amber-800">
            Hay cambios sin guardar. Los acomodos de la IA viven solo en esta pantalla hasta que los
            guardes.
          </span>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={busy}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Guardar cambios
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {analysis && (
        <>
          <div className="mt-4 flex flex-col gap-2.5">
            {analysis.breakdown.map((block) => (
              <div key={block.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-600">
                    {block.label}
                    <span className="ml-1 text-zinc-400">({Math.round(block.weight * 100)}%)</span>
                  </span>
                  <span className="text-xs font-semibold text-zinc-700">{block.score}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                  <div
                    className={`h-full rounded-full ${barColor(block.score)}`}
                    style={{ width: `${block.score}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-400">{block.detail}</p>
              </div>
            ))}
          </div>

          {analysis.missingKeywords.length > 0 ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Palabras clave que faltan ({analysis.missingKeywords.length})
                </h3>
                <button
                  type="button"
                  onClick={() => void fixKeywords()}
                  disabled={busy || fixing}
                  className="rounded-lg border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {fixing ? "Acomodando…" : "Acomodarlas con IA"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {analysis.missingKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    title="Un ATS busca esta palabra en tu HV"
                    className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                La IA solo integra las que estén respaldadas por tu perfil: no inventa experiencia.
                Revisá la vista previa antes de guardar.
              </p>
              {fixMsg && <p className="mt-1 text-xs text-emerald-700">{fixMsg}</p>}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
              Cubre todas las palabras clave que se pudieron extraer de la oferta.
            </p>
          )}

          {analysis.warnings.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Qué puede leer mal
              </h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-zinc-600">
                {analysis.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.suggestions.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Qué hacer
              </h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-emerald-700">
                {analysis.suggestions.map((suggestion, i) => (
                  <li key={i}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowText((v) => !v)}
            className="mt-4 text-xs text-zinc-400 underline hover:text-zinc-600"
          >
            {showText ? "Ocultar" : "Ver"} el texto que lee el ATS
          </button>
          {showText && (
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-[11px] leading-relaxed text-zinc-600">
              {resumeToAtsText(content)}
            </pre>
          )}

          <p className="mt-3 border-t border-zinc-100 pt-2 text-[11px] text-zinc-400">
            El score mide lo que se puede medir con palabras clave y formato. Filtros como
            &quot;X años de experiencia&quot; o &quot;título universitario&quot; son knockout y no se
            arreglan desde acá.
          </p>
        </>
      )}
    </Card>
  );
}
