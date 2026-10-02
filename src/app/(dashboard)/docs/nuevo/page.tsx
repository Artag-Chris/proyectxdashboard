"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Card, ErrorBox, Field, Input, Select, Textarea } from "@/lib/social-ui";
import { docsApi } from "@/lib/docs-api";
import { usePoll } from "@/lib/usePoll";
import { FILE_KIND_LABEL, FORMAT_LABEL, OPERATION_HINT, OPERATION_LABEL, formatBytes } from "@/lib/docs-ui";
import type {
  DocFormat,
  DocJob,
  DocOperation,
  DocumentTemplate,
  Norm,
  SourceFile,
} from "@/lib/docs-types";

const OPERATIONS: DocOperation[] = ["REWRITE", "ANONYMIZE", "FROM_TEMPLATE", "CONVERT", "EXCEL_EDIT"];
// Excel no se ofrece como formato libre: una operación de documento solo produce
// PDF/Word y un Excel editado solo produce .xlsx (el harness lo valida igual).
const FORMATS: DocFormat[] = ["PDF", "DOCX"];

/** Alta guiada de un trabajo: archivo → operación → formato/norma → instrucción. */
export default function NewDocPage() {
  const router = useRouter();
  const sources = usePoll(() => docsApi.get<SourceFile[]>("/sources"), 20000);
  const norms = usePoll(() => docsApi.get<{ norms: Norm[] }>("/norms"), 60000);
  const templates = usePoll(() => docsApi.get<DocumentTemplate[]>("/templates"), 60000);

  const [selected, setSelected] = useState<string[]>([]);
  const [operation, setOperation] = useState<DocOperation>("REWRITE");
  const [formats, setFormats] = useState<DocFormat[]>(["PDF"]);
  const [norm, setNorm] = useState<string>("custom");
  const [templateId, setTemplateId] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isExcel = operation === "EXCEL_EDIT";

  const toggleSource = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const toggleFormat = (format: DocFormat) => {
    setFormats((current) =>
      current.includes(format) ? current.filter((value) => value !== format) : [...current, format],
    );
  };

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const created = await docsApi.upload<SourceFile>("/sources", form);
      setSelected((current) => [...current, created.id]);
      sources.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const nextFormats = isExcel ? (["XLSX"] as DocFormat[]) : formats.length > 0 ? formats : ["PDF"];
      const job = await docsApi.post<DocJob>("/jobs", {
        operation,
        sourceIds: selected,
        instruction: instruction.trim() || undefined,
        targetFormats: nextFormats,
        norm: isExcel ? undefined : norm,
        templateId: templateId || undefined,
      });
      router.push(`/docs/${job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Nuevo documento</h1>
      <ErrorBox message={error} />

      {/* 1. Entrada */}
      <Card>
        <p className="mb-2 text-sm font-semibold text-emerald-700">1. Material de entrada</p>
        <input
          type="file"
          accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-white"
        />
        {uploading && <p className="mt-2 text-xs text-zinc-400">Subiendo y extrayendo…</p>}

        {sources.data && sources.data.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-zinc-500">O elegí uno ya subido:</p>
            {sources.data.map((source) => (
              <label
                key={source.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(source.id)}
                    onChange={() => toggleSource(source.id)}
                  />
                  <Badge tone="zinc">{FILE_KIND_LABEL[source.kind]}</Badge>
                  <span className="truncate">{source.filename}</span>
                </span>
                <span className="text-xs text-zinc-400">{formatBytes(source.sizeBytes)}</span>
              </label>
            ))}
          </div>
        )}
        {operation === "FROM_TEMPLATE" && (
          <p className="mt-2 text-xs text-zinc-400">
            Podés no elegir ninguno y escribir la instrucción en el paso 4.
          </p>
        )}
      </Card>

      {/* 2. Operación */}
      <Card>
        <p className="mb-2 text-sm font-semibold text-emerald-700">2. Qué querés hacer</p>
        <div className="grid gap-2 md:grid-cols-2">
          {OPERATIONS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setOperation(value)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                operation === value
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <span className="font-medium">{OPERATION_LABEL[value]}</span>
              <span className="mt-1 block text-xs text-zinc-500">{OPERATION_HINT[value]}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* 3. Formato y norma */}
      <Card>
        <p className="mb-2 text-sm font-semibold text-emerald-700">3. Formato de salida</p>
        {isExcel ? (
          <p className="text-sm text-zinc-500">Un Excel editado se descarga en .xlsx.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((format) => (
                <label
                  key={format}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${
                    formats.includes(format) ? "border-emerald-500 bg-emerald-50" : "border-zinc-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={formats.includes(format)}
                    onChange={() => toggleFormat(format)}
                  />
                  {FORMAT_LABEL[format]}
                </label>
              ))}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Norma de formato">
                <Select value={norm} onChange={(e) => setNorm(e.target.value)}>
                  {(norms.data?.norms ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Plantilla (opcional)">
                <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Sin plantilla</option>
                  {(templates.data ?? []).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {(norms.data?.norms ?? [])
              .filter((item) => item.id === norm)
              .map((item) => (
                <p key={item.id} className="mt-2 text-xs text-zinc-400">
                  {item.description}
                </p>
              ))}
          </>
        )}
      </Card>

      {/* 4. Instrucción */}
      <Card>
        <p className="mb-2 text-sm font-semibold text-emerald-700">4. Instrucción (opcional)</p>
        <Textarea
          rows={3}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ej.: reescribilo en tono formal, agregá un resumen al inicio, traducí al inglés…"
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={create} disabled={busy || uploading}>
          {busy ? "Creando…" : "Generar documento"}
        </Button>
      </div>
    </div>
  );
}
