"use client";

import { useState } from "react";
import { Badge, Button, Card, ErrorBox, Field, Input, Loading, Select } from "@/lib/social-ui";
import { docsApi } from "@/lib/docs-api";
import { usePoll } from "@/lib/usePoll";
import type { DocumentTemplate, Norm } from "@/lib/docs-types";

interface SpecDraft {
  top: number;
  right: number;
  bottom: number;
  left: number;
  fontFamily: "Helvetica" | "Times-Roman" | "Courier";
  fontSize: number;
  coverPage: boolean;
  headingNumbering: boolean;
  pageNumbering: "none" | "top-right" | "bottom-center";
  runningHeader: string;
}

const DEFAULT_SPEC: SpecDraft = {
  top: 2.5,
  right: 2.5,
  bottom: 2.5,
  left: 2.5,
  fontFamily: "Helvetica",
  fontSize: 11,
  coverPage: true,
  headingNumbering: false,
  pageNumbering: "bottom-center",
  runningHeader: "",
};

/** Plantillas propias (estilo propio): afinan márgenes, tipografía, portada y membrete. */
export default function TemplatesPage() {
  const templates = usePoll(() => docsApi.get<DocumentTemplate[]>("/templates"), 20000);
  const norms = usePoll(() => docsApi.get<{ norms: Norm[] }>("/norms"), 120000);

  const [name, setName] = useState("");
  const [norm, setNorm] = useState("custom");
  const [spec, setSpec] = useState<SpecDraft>(DEFAULT_SPEC);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await docsApi.post("/templates", {
        name: name.trim(),
        kind: "pdf",
        norm,
        spec: {
          marginsCm: { top: spec.top, right: spec.right, bottom: spec.bottom, left: spec.left },
          fontFamily: spec.fontFamily,
          fontSize: spec.fontSize,
          coverPage: spec.coverPage,
          headingNumbering: spec.headingNumbering,
          pageNumbering: spec.pageNumbering,
          runningHeader: { text: spec.runningHeader, showTitle: false },
        },
      });
      setName("");
      setSpec(DEFAULT_SPEC);
      templates.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await docsApi.del(`/templates/${id}`);
      templates.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-lg font-semibold">Plantillas</h1>
      <p className="text-sm text-zinc-500">
        Una plantilla afina la norma elegida (márgenes, tipografía, portada, membrete). Si no
        necesitás nada especial, con la norma alcanza.
      </p>
      <ErrorBox message={error} />

      <Card>
        <p className="mb-2 text-sm font-semibold text-emerald-700">Nueva plantilla</p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Informe de la empresa" />
          </Field>
          <Field label="Norma base">
            <Select value={norm} onChange={(e) => setNorm(e.target.value)}>
              {(norms.data?.norms ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <Field key={side} label={`Margen ${side} (cm)`}>
              <Input
                type="number"
                step="0.1"
                value={spec[side]}
                onChange={(e) => setSpec({ ...spec, [side]: Number(e.target.value) })}
              />
            </Field>
          ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="Tipografía">
            <Select
              value={spec.fontFamily}
              onChange={(e) => setSpec({ ...spec, fontFamily: e.target.value as SpecDraft["fontFamily"] })}
            >
              <option value="Helvetica">Helvetica (Arial)</option>
              <option value="Times-Roman">Times New Roman</option>
              <option value="Courier">Courier</option>
            </Select>
          </Field>
          <Field label="Tamaño (pt)">
            <Input
              type="number"
              value={spec.fontSize}
              onChange={(e) => setSpec({ ...spec, fontSize: Number(e.target.value) })}
            />
          </Field>
          <Field label="Numeración de página">
            <Select
              value={spec.pageNumbering}
              onChange={(e) =>
                setSpec({ ...spec, pageNumbering: e.target.value as SpecDraft["pageNumbering"] })
              }
            >
              <option value="none">Sin numeración</option>
              <option value="top-right">Arriba a la derecha</option>
              <option value="bottom-center">Abajo al centro</option>
            </Select>
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={spec.coverPage}
              onChange={(e) => setSpec({ ...spec, coverPage: e.target.checked })}
            />
            Portada
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={spec.headingNumbering}
              onChange={(e) => setSpec({ ...spec, headingNumbering: e.target.checked })}
            />
            Secciones numeradas
          </label>
        </div>

        <div className="mt-3">
          <Field label="Membrete (encabezado)" hint="Texto que aparece arriba en cada página.">
            <Input
              value={spec.runningHeader}
              onChange={(e) => setSpec({ ...spec, runningHeader: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-3 flex justify-end">
          <Button onClick={create} disabled={busy || name.trim().length === 0}>
            Crear plantilla
          </Button>
        </div>
      </Card>

      {!templates.data && !templates.error && <Loading />}
      <div className="space-y-2">
        {(templates.data ?? []).map((template) => (
          <Card key={template.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium">{template.name}</span>
                <div className="mt-1 flex gap-1">
                  <Badge tone="zinc">{template.kind}</Badge>
                  {template.norm && <Badge tone="blue">{template.norm}</Badge>}
                  {template.builtin && <Badge tone="amber">de fábrica</Badge>}
                </div>
              </div>
              {!template.builtin && (
                <Button variant="danger" disabled={busy} onClick={() => remove(template.id)}>
                  Borrar
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
