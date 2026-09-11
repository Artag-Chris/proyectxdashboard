export type VacancyStatus =
  | "RAW"
  | "NORMALIZED"
  | "MATCHED"
  | "RESUME_READY"
  | "APPLIED"
  | "IGNORED";

export interface ScrapeRunInfo {
  status: "RUNNING" | "OK" | "FAILED";
  error: string | null;
  itemsFound: number;
  itemsNew: number;
  startedAt: string;
}

export interface SourceRow {
  id: string;
  name: string;
  kind: string;
  listUrl: string;
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: string | null;
  nextRunAt: string;
  /** Receta CSS + límites configurados (editor avanzado / plantilla). */
  selectors?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  /** Última corrida del scraper (para diagnosticar fallos: 403, timeout…). */
  runs?: ScrapeRunInfo[];
  _count?: { vacancies: number };
  selections?: { id: string; enabled: boolean; profile: { id: string; name: string } }[];
}

export interface SourceTemplate {
  id: string;
  label: string;
  hint: string;
}

/** Resultado de analizar una URL (POST /sources/probe). */
export interface ProbeItem {
  title: string;
  url: string;
  company?: string;
  location?: string;
  salary?: string;
  postedAt?: string;
  descriptionChars: number;
}

export interface ProbeResult {
  listUrl: string;
  finalUrl: string;
  status: number;
  bytes: number;
  chosenBy: "plantilla" | "heuristica" | "ia";
  templateId?: string;
  selectors: Record<string, unknown>;
  limits: Record<string, unknown>;
  preview: ProbeItem[];
  diagnostics: {
    itemCount: number;
    itemsWithUrl: number;
    itemsWithDescription: number;
    warnings: string[];
    alternatives: { by: string; itemCount: number; score: number }[];
  };
}

export interface ProfileRow {
  id: string;
  name: string;
  headline: string[];
  isPrimary: boolean;
  scheduleMinutes: number | null;
  nextRunAt: string | null;
  _count: {
    skills: number;
    projects: number;
    experiences: number;
    sources: number;
    resumes: number;
  };
}

export interface ResumeRow {
  id: string;
  name: string;
  kind: string;
  status: "PENDING" | "EMBEDDING" | "READY" | "FAILED";
  error: string | null;
  active: boolean;
  chunkCount: number;
  createdAt: string;
}

/** Evaluación de UNA vacante por UN perfil (score y HV propios). */
export interface VacancyProfileInfo {
  profileId: string;
  profileName: string;
  status: string;
  score: number | null;
  hasResume: boolean;
}

export interface VacancyRow {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  status: VacancyStatus;
  /** Con perfil elegido es SU score; sin perfil, el mejor de cualquier perfil. */
  matchScore: number | null;
  source: { id: string; name: string };
  match: { id: string; score: number; verdict: string } | null;
  profiles: VacancyProfileInfo[];
  /** Oferta pegada a mano (fuente sintética MANUAL), no scrapeada. */
  isManual?: boolean;
}

export interface VacancyDetail {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  modality: string | null;
  url: string;
  status: VacancyStatus;
  matchScore: number | null;
  enrichment: {
    summary?: string;
    keyRequirements?: string[];
    niceToHave?: string[];
    skills?: string[];
    seniority?: string;
  } | null;
  raw: Record<string, unknown>;
  source: { name: string };
  match: {
    id: string;
    score: number;
    analysisScore: number | null;
    semanticScore: number | null;
    verdict: string;
    reasons: string[];
    gaps: string[];
    applicationStrategy: {
      highlights: string[];
      keywords: string[];
      angle: string;
      suggestedChannel: string;
    };
    coverLetterDraft: string | null;
  } | null;
  resume: ResumeDraft | null;
  /** Una entrada por perfil que evaluó la vacante (match y HV propios). */
  profiles: VacancyDetailProfile[];
  /** Oferta pegada a mano (fuente sintética MANUAL), no scrapeada. */
  isManual?: boolean;
}

/** Respuesta de POST /vacancies/from-text (oferta pegada a mano). */
export interface ManualIntakeResponse {
  vacancyId: string;
  /** true si ya existía una vacante con la misma huella (no se duplicó). */
  reused: boolean;
  profileId: string;
}

/** Borrador de HV generado por la IA (contenido + metadatos). */
export interface ResumeDraft {
  id: string;
  /** Perfil dueño del borrador (el PDF usa sus datos de contacto). */
  profileId: string;
  content: ResumeDraftContent;
  status: string;
  version: number;
}

export interface ResumeExperienceItem {
  role?: string;
  company?: string;
  period?: string;
  bullets?: string[];
}

export interface ResumeProjectItem {
  name?: string;
  highlights?: string[];
}

export interface ResumeEducationItem {
  institution?: string;
  degree?: string;
  period?: string;
}

/**
 * Secciones redactadas por la IA. Se conservan como índices sueltos porque el
 * JSON lo genera el LLM y puede llegar parcial; la plantilla del PDF tolera
 * campos ausentes.
 */
export interface ResumeDraftContent {
  headline?: string;
  summary?: string;
  skills?: string[];
  experience?: ResumeExperienceItem[];
  projects?: ResumeProjectItem[];
  education?: ResumeEducationItem[];
  softSkills?: string[];
  keywords?: string[];
  markdown?: string;
  /** Carta de presentación (se guarda dentro del mismo JSON del borrador). */
  coverLetter?: string;
  coverLetterSource?: "ia" | "plantilla" | "editada";
  coverLetterUpdatedAt?: string;
}

/** Respuesta de POST /resumes/:id/refine (reorganización con IA). */
export interface RefineResponse {
  id: string;
  content: ResumeDraftContent;
  applied: boolean;
  note: string;
}

export interface VacancyDetailProfile {
  profileId: string;
  profileName: string;
  status: string;
  score: number | null;
  match: VacancyDetail["match"];
  resume: ResumeDraft | null;
}

/** Respuesta de GET /profiles/:id (lo que necesita el PDF para el contacto). */
export interface ProfilePdfInfo {
  id: string;
  name: string;
  headline: string[];
  email: string | null;
  phone: string | null;
  location: string | null;
  languages: { language: string; level: string }[];
  links: { type: string; url: string; isPrimary: boolean }[];
}

export interface CoverLetterResponse {
  id: string;
  coverLetter: string;
  coverLetterSource: "ia" | "plantilla" | "editada";
  coverLetterUpdatedAt: string;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: { vacancyId?: string };
  readAt: string | null;
  createdAt: string;
}
