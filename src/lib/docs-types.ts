// Tipos de la pestaña Documentos (Doc Harness). Reflejan el contrato del harness:
// el contenido intermedio es ESTRUCTURADO (bloques / hojas), no markdown.

export type DocFormat = "PDF" | "DOCX" | "XLSX";
export type DocOperation = "REWRITE" | "ANONYMIZE" | "FROM_TEMPLATE" | "CONVERT" | "EXCEL_EDIT";
export type DocJobStatus = "QUEUED" | "RUNNING" | "DONE" | "ERROR";
export type FileKind = "PDF" | "DOCX" | "XLSX" | "CSV" | "TXT" | "MD";

export type DocBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "pagebreak" };

export interface DocReference {
  text: string;
  url?: string;
}

export interface DocContent {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  blocks: DocBlock[];
  references?: DocReference[];
}

export type CellValue = string | number | boolean | null;

export interface Sheet {
  name: string;
  columns: string[];
  rows: CellValue[][];
}

export interface WorkbookContent {
  sheets: Sheet[];
}

export interface SourceFile {
  id: string;
  filename: string;
  mime: string;
  sizeBytes: number;
  kind: FileKind;
  extractedText: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface DocArtifact {
  id: string;
  format: DocFormat;
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DocJob {
  id: string;
  operation: DocOperation;
  status: DocJobStatus;
  instruction: string | null;
  targetFormats: DocFormat[];
  norm: string | null;
  templateId: string | null;
  content: DocContent | null;
  workbook: WorkbookContent | null;
  error: string | null;
  editedByUser: boolean;
  createdAt: string;
  updatedAt: string;
  artifacts?: DocArtifact[];
}

export interface Norm {
  id: string;
  label: string;
  description: string;
  spec: Record<string, unknown>;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  kind: "pdf" | "docx";
  norm: string | null;
  spec: Record<string, unknown>;
  builtin: boolean;
}

export interface AnonymizeEntity {
  kind: string;
  value: string;
  placeholder: string;
}

export interface UsageSummary {
  total: { calls: number; tokensIn: number; tokensOut: number; costUsd: number };
  recent: Array<{
    id: string;
    job: string;
    model: string | null;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    createdAt: string;
  }>;
}
