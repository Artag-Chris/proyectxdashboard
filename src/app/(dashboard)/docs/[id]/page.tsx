"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorBox, Field, Loading, Select, fmtDateTime } from "@/lib/social-ui";
import { docsApi } from "@/lib/docs-api";
import { usePoll } from "@/lib/usePoll";
import { FORMAT_LABEL, OPERATION_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/docs-ui";
import { ContentEditor } from "@/components/docs/ContentEditor";
import { WorkbookEditor } from "@/components/docs/WorkbookEditor";
import { AnonymizePanel } from "@/components/docs/AnonymizePanel";
import { PdfPreview } from "@/components/docs/PdfPreview";
import type { DocContent, DocFormat, DocJob, Norm, WorkbookContent } from "@/lib/docs-types";

const DOC_FORMATS: DocFormat[] = ["PDF", "DOCX"];
const EXCEL_FORMATS: DocFormat[] = ["XLSX"];

export default function DocJobPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const job = usePoll(() => docsApi.get<DocJob>(`/jobs/${id}`), 4000);
  const norms = usePoll(() => docsApi.get<{ norms: Norm[] }>("/norms"), 120000);

  const [draft, setDraft] = useState<DocContent | null>(null);
  const [draftWorkbook, setDraftWorkbook] = useState<WorkbookContent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [formats, setFormats] = useState<DocFormat[]>([]);
  const [norm, setNorm] = useState("");

  useEffect(() => {
    if (!job.data || dirty) return;
    setDraft(job.data.content ?? null);
    setDraftWorkbook(job.data.workbook ?? null);
    setFormats(job.data.targetFormats ?? []);
    setNorm(job.data.norm ?? "custom");
  }, [job.data, dirty]);

  const run = async (action: () => Promise<unknown>, refreshPreview = true) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setDirty(false);
      job.reload();
      if (refreshPreview) setPreviewVersion((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!job.data && !job.error) return <Loading />;
  if (job.error) return <ErrorBox message={job.error} />;

  const data = job.data as DocJob;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href="/docs" className="text-sm text-zinc-500 hover:underline">
            ← Documentos
          </Link>
          <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
          <span className="font-medium">{OPERATION_LABEL[data.operation]}</span>
        </div>
        <Button
          variant="danger"
          onClick={() =>
            run(async () => {
              await docsApi.del(`/jobs/${id}`);
              router.push("/docs");
            }, false)
          }
          disabled={busy}
        >
          Borrar
        </Button>
      </div>

      <ErrorBox message={data.error} />
      <ErrorBox message={error} />
      <p className="text-xs text-zinc-400">Actualizado {fmtDateTime(data.updatedAt)}</p>

      {data.status === "QUEUED" || data.status === "RUNNING" ? (
        <Card>
          <Loading what="La IA está trabajando… esta vista se actualiza sola." />
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {draft && (
            <Card>
              <p className="mb-2 text-sm font-semibold text-emerald-700">Contenido</p>
              <ContentEditor
                content={draft}
                onChange={(next) => {
                  setDraft(next);
                  setDirty(true);
                }}
                onRefine={(instruction) =>
                  run(() => docsApi.post(`/jobs/${id}/refine`, { instruction }))
                }
                refining={busy}
              />
              <div className="mt-3 flex items-center gap-2">
                <Button
                  disabled={busy || !dirty}
                  onClick={() =>
                    run(() => docsApi.patch(`/jobs/${id}/content`, { content: draft }))
                  }
                >
                  Guardar cambios
                </Button>
                {dirty && <span className="text-xs text-amber-600">Cambios sin guardar</span>}
              </div>
            </Card>
          )}

          {draftWorkbook && (
            <Card>
              <p className="mb-2 text-sm font-semibold text-emerald-700">Planilla</p>
              <WorkbookEditor
                workbook={draftWorkbook}
                onChange={(next) => {
                  setDraftWorkbook(next);
                  setDirty(true);
                }}
              />
              <div className="mt-3 flex items-center gap-2">
                <Button
                  disabled={busy || !dirty}
                  onClick={() =>
                    run(() => docsApi.patch(`/jobs/${id}/content`, { workbook: draftWorkbook }))
                  }
                >
                  Guardar cambios
                </Button>
                {dirty && <span className="text-xs text-amber-600">Cambios sin guardar</span>}
              </div>
            </Card>
          )}

          {(draft || draftWorkbook) && (
            <Card>
              <p className="mb-2 text-sm font-semibold text-emerald-700">Datos personales</p>
              <AnonymizePanel
                jobId={id}
                onApplied={() => {
                  job.reload();
                  setPreviewVersion((value) => value + 1);
                }}
              />
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <p className="mb-2 text-sm font-semibold text-emerald-700">Descargas</p>
            {data.artifacts && data.artifacts.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data.artifacts.map((artifact) => (
                  <Button
                    key={artifact.id}
                    variant="secondary"
                    disabled={busy}
                    onClick={() => docsApi.download(`/jobs/${id}/download?format=${artifact.format}`, artifact.filename)}
                  >
                    ↓ {FORMAT_LABEL[artifact.format]}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Todavía no hay archivos generados.</p>
            )}
          </Card>

          {!draftWorkbook && (
            <Card>
              <p className="mb-2 text-sm font-semibold text-emerald-700">Re-renderizar</p>
              <div className="flex flex-wrap gap-2">
                {(data.operation === "EXCEL_EDIT" ? EXCEL_FORMATS : DOC_FORMATS).map((format) => (
                  <label
                    key={format}
                    className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                      formats.includes(format) ? "border-emerald-500 bg-emerald-50" : "border-zinc-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={formats.includes(format)}
                      onChange={() =>
                        setFormats((current) =>
                          current.includes(format)
                            ? current.filter((value) => value !== format)
                            : [...current, format],
                        )
                      }
                    />
                    {FORMAT_LABEL[format]}
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <Field label="Norma">
                  <Select value={norm} onChange={(e) => setNorm(e.target.value)}>
                    {(norms.data?.norms ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="mt-3">
                <Button
                  disabled={busy || formats.length === 0}
                  onClick={() =>
                    run(() =>
                      docsApi.post(`/jobs/${id}/render`, { targetFormats: formats, norm }),
                    )
                  }
                >
                  Re-renderizar
                </Button>
              </div>
            </Card>
          )}

          {draft && (
            <Card>
              <p className="mb-2 text-sm font-semibold text-emerald-700">Vista previa</p>
              <PdfPreview jobId={id} version={previewVersion} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
