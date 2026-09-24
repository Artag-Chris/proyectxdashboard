// Tipos de Social-Harness tal como los devuelve su API (respuestas con include).
// Se declaran acá (y no se reutilizan los de cv-harness) porque son dominios
// distintos: acá lo que importa es señal, relevancia, idea y calendario.

export type PlatformKey = "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "LINKEDIN";

export type IdeaStatus = "IDEA" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "DISCARDED";

export type SignalKind =
  | "TREND"
  | "NEWS"
  | "VIDEO"
  | "POST"
  | "ARTICLE"
  | "INSPIRATION"
  | "OTHER";

export interface SocialAccount {
  id: string;
  profileId: string;
  platform: PlatformKey;
  handle: string;
  profileUrl: string | null;
  isPrimary: boolean;
  notes: string | null;
}

export interface Objective {
  id: string;
  metric: string;
  targetValue: number;
  currentValue: number | null;
  dueDate: string | null;
}

export interface ProfileSource {
  id: string;
  enabled: boolean;
  source: Source;
}

export interface Profile {
  id: string;
  name: string;
  niche: string[];
  audience: string | null;
  voice: string | null;
  language: string;
  timezone: string;
  scheduleHours: number | null;
  autoIdeasEnabled: boolean;
  ideasPerWeek: number;
  nextRunAt: string | null;
  accounts: SocialAccount[];
  objectives: Objective[];
  sources: ProfileSource[];
  _count: { ideas: number; profileSignals: number };
}

export interface SignalView {
  id: string;
  kind: SignalKind;
  title: string;
  url: string | null;
  summary: string | null;
  author: string | null;
  platform: PlatformKey | null;
  publishedAt: string | null;
  region: string | null;
  keywords: string[];
  metrics: Record<string, unknown>;
  status: string;
  isDuplicate: boolean;
  duplicateOfId: string | null;
  createdAt: string;
  source: { id: string; name: string; kind: string } | null;
  /** Relevancia POR PERFIL (0 = todavía sin analizar). */
  relevance: Array<{
    profileId: string;
    score: number;
    status: string;
    reasons: string[];
  }>;
}

export interface SignalListResponse {
  total: number;
  count: number;
  signals: SignalView[];
}

export interface IdeaSignalLink {
  id: string;
  signalId: string;
  contribution: string | null;
  signal: { id: string; title: string; url: string | null; kind: string; summary?: string | null };
}

export interface DraftContent {
  caption: string;
  script: string;
  hookVariants: string[];
  cta: string;
  notes: string;
}

export interface Draft {
  id: string;
  ideaId: string;
  content: DraftContent;
  language: string;
  editedByUser: boolean;
  version: number;
  createdAt: string;
}

export interface BestTime {
  day: string;
  hour: string;
  reason: string;
}

export interface Idea {
  id: string;
  profileId: string;
  platform: PlatformKey;
  format: string;
  title: string;
  hook: string;
  angle: string;
  whyNow: string;
  hashtags: string[];
  bestTimes: BestTime[];
  status: IdeaStatus;
  scheduledFor: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  /** `ia` | `plantilla` | `manual` — de dónde salió el texto. */
  source: string;
  createdAt: string;
  signals?: IdeaSignalLink[];
  drafts?: Draft[];
}

export interface Source {
  id: string;
  name: string;
  kind: string;
  /** Los `params` cambian según el tipo (RSS: feedUrl; Trends: keywords…). */
  params: Record<string, unknown>;
  limits: Record<string, number | boolean>;
  intervalHours: number | null;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
}

/** Etiqueta legible de una fuente: cada tipo guarda su URL con otro nombre. */
export function sourceTarget(source: Source): string {
  const params = source.params ?? {};
  const feedUrl = params.feedUrl;
  const listUrl = params.listUrl;
  const keywords = params.keywords;
  if (typeof feedUrl === "string") return feedUrl;
  if (typeof listUrl === "string") return listUrl;
  if (Array.isArray(keywords)) return keywords.join(", ");
  return source.kind === "MANUAL" ? "carga a mano" : "";
}

export interface Notification {
  id: string;
  profileId: string | null;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  profile: { id: string; name: string } | null;
}

export interface NotificationList {
  unread: number;
  count: number;
  notifications: Notification[];
}

export interface MetricSnapshot {
  id: string;
  socialAccountId: string;
  capturedAt: string;
  source: string;
  followers: number | null;
  reach: number | null;
  impressions: number | null;
  engagementRate: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

export interface PerformanceReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  whatWorked: string[];
  whatDidnt: string[];
  adjustments: string[];
  createdAt: string;
}

/** Unidad del objetivo, para no tener que adivinarla al mostrarlo. */
export type ObjectiveUnit = "COUNT" | "PERCENT" | "PER_WEEK";

/**
 * Veredicto del gap. `NO_PACE` y `NO_CURRENT` son los casos honestos: no alcanzan los datos
 * para saber si llegás (en vez de inventar una proyección).
 */
export type ObjectiveVerdict = "ACHIEVED" | "ON_TRACK" | "BEHIND" | "NO_PACE" | "NO_CURRENT";

/** Gap de un objetivo: lo calcula el harness con aritmética, sin IA. */
export interface ObjectiveGap {
  metric: string;
  unit: ObjectiveUnit;
  target: number;
  current: number | null;
  remaining: number | null;
  daysLeft: number | null;
  /** Lo que hace falta por semana para llegar a tiempo. */
  neededPerWeek: number | null;
  /** Lo que se viene sumando por semana (`null` = no hay ritmo medible). */
  currentPerWeek: number | null;
  /** A dónde llegás si seguís al ritmo actual. */
  projected: number | null;
  verdict: ObjectiveVerdict;
}

export interface AccountGrowth {
  platform: PlatformKey;
  handle: string;
  followers?: { from: number; to: number; delta: number; perWeek: number };
  reach?: number;
  engagementRate?: number;
  daysMeasured: number;
  windowDays: number;
}

export interface Growth {
  windowDays: number;
  accounts: AccountGrowth[];
  objectives: ObjectiveGap[];
  measured: { accounts: number; snapshots: number };
}

/**
 * Segmento de audiencia: a quién le habla el perfil.
 *
 * Es el objeto que comparten los coaches (el de comunidad lo produce, el de contenido lo
 * usa para escribir), por eso vive como entidad y no como texto suelto.
 */
export interface AudienceSegment {
  id: string;
  profileId: string;
  name: string;
  description: string;
  pains: string[];
  desires: string[];
  objections: string[];
  /** Dónde está esa gente (subreddits, grupos, hashtags, canales). */
  channels: string[];
  languageTips: string | null;
  /** De qué material salió: es lo que hace auditable una propuesta de IA. */
  evidence: string[];
  /** `ia` | `manual` | `plantilla` — no se disfraza una plantilla de sugerencia del modelo. */
  source: string;
  archivedAt: string | null;
  createdAt: string;
}

/**
 * Comunidad donde participar (subreddit, grupo, canal, hashtag…).
 *
 * `status` es lo que decidió el humano y `verifiedAt` si confirmó que el lugar existe: una
 * propuesta de IA nace `PROPOSED` y sin verificar, porque puede estar inventada.
 */
export interface CommunityTarget {
  id: string;
  profileId: string;
  kind: string;
  name: string;
  url: string | null;
  size: string | null;
  activity: string | null;
  audienceFit: number;
  why: string;
  segmentId: string | null;
  segment?: { id: string; name: string } | null;
  status: string;
  /** `ia` | `manual` | `plantilla`. */
  source: string;
  notes: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface Usage {
  window: { days: number; from: string; to: string };
  totals: { runs: number; tokensIn: number; tokensOut: number; costUsd: number };
  byJob: Array<{
    job: string;
    runs: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    avgLatencyMs: number;
  }>;
  byDay: Array<{ day: string; runs: number; tokensIn: number; tokensOut: number; costUsd: number }>;
}

export interface PlatformFormatDef {
  key: string;
  label: string;
  kind: string;
  isVideo: boolean;
  notes?: string;
}

export interface PlatformDef {
  key: PlatformKey;
  label: string;
  formats: string[];
  defaultFormats: string[];
  formatDetails: PlatformFormatDef[];
  contentHint: string;
  bestTimesHint: string;
  hashtagsHint: string;
  scrapingAllowed: boolean;
  trendsStrategy: string;
  officialMetricsApi: string | null;
}

export interface AppConfig {
  llm: { provider: string; model: string; mock: boolean; fallback: string | null };
  embeddings: { provider: string; model: string; mock: boolean; semantic: boolean };
  ideas: { auto: boolean; perWeek: number; relevanceMinScore: number; analyzeBatchSize: number };
  scheduler: { intervalMinutes: number; cadenceHoursOptions: number[] };
  dedup: Record<string, unknown>;
  notifications: { channels: string[] };
  connectors: { enabled: string[]; implemented: string[] };
}
