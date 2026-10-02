"use client";

// Etiquetas y helpers de la pestaña Documentos. Reutiliza el kit de social-ui
// (Card/Button/Field/Input/Select/Badge/ErrorBox/Loading) para no traer librería nueva.
import type { DocFormat, DocJobStatus, DocOperation, FileKind } from "./docs-types";

export const OPERATION_LABEL: Record<DocOperation, string> = {
  REWRITE: "Reescribir / mejorar",
  ANONYMIZE: "Reemplazar nombres y datos",
  FROM_TEMPLATE: "Generar desde plantilla",
  CONVERT: "Convertir formato",
  EXCEL_EDIT: "Editar Excel",
};

export const OPERATION_HINT: Record<DocOperation, string> = {
  REWRITE: "La IA reescribe y mejora el documento conservando los hechos.",
  ANONYMIZE: "Detecta y reemplaza nombres, correos, teléfonos e IDs que vos aprobés.",
  FROM_TEMPLATE: "Redacta un documento nuevo siguiendo una plantilla o una instrucción.",
  CONVERT: "Pasa el material a Word/PDF (o un Excel a tabla) sin resumir.",
  EXCEL_EDIT: "Limpia, reformula o agrega columnas a una planilla y la devuelve en Excel.",
};

export const FORMAT_LABEL: Record<DocFormat, string> = {
  PDF: "PDF",
  DOCX: "Word (.docx)",
  XLSX: "Excel (.xlsx)",
};

export const STATUS_LABEL: Record<DocJobStatus, string> = {
  QUEUED: "En cola",
  RUNNING: "Procesando",
  DONE: "Listo",
  ERROR: "Error",
};

export const STATUS_TONE: Record<DocJobStatus, "zinc" | "emerald" | "amber" | "red" | "blue" | "violet"> = {
  QUEUED: "zinc",
  RUNNING: "amber",
  DONE: "emerald",
  ERROR: "red",
};

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  PDF: "PDF",
  DOCX: "Word",
  XLSX: "Excel",
  CSV: "CSV",
  TXT: "Texto",
  MD: "Markdown",
};

export const ANONYMIZE_KIND_LABEL: Record<string, string> = {
  nombre: "Nombre",
  empresa: "Empresa",
  email: "Correo",
  telefono: "Teléfono",
  id: "Documento/ID",
  direccion: "Dirección",
  url: "URL",
  otro: "Otro",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
