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
  profileId: string | null;
  lastRunAt: string | null;
  nextRunAt: string;
  /** Última corrida del scraper (para diagnosticar fallos: 403, timeout…). */
  runs?: ScrapeRunInfo[];
  _count?: { vacancies: number };
  profile?: { id: string; name: string } | null;
}

export interface SourceTemplate {
  id: string;
  label: string;
  hint: string;
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

export interface VacancyRow {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  status: VacancyStatus;
  matchScore: number | null;
  source: { id: string; name: string };
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
  resume: {
    id: string;
    content: { summary?: string; markdown?: string; headline?: string; skills?: string[] };
    status: string;
    version: number;
  } | null;
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
