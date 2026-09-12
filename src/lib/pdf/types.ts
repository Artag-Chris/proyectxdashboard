/** Contenido del borrador de HV generado por la IA para una vacante. */
export interface ResumePdfContent {
  headline?: string;
  summary?: string;
  skills?: string[];
  experience?: {
    role?: string;
    company?: string;
    period?: string;
    bullets?: string[];
  }[];
  projects?: { name?: string; highlights?: string[] }[];
  education?: { institution?: string; degree?: string; period?: string }[];
  softSkills?: string[];
  keywords?: string[];
  /**
   * Modo ATS: una sola columna, encabezados estándar y contacto limpio. Lo que
   * gana en parseabilidad lo pierde en fidelidad con el CV original de dos
   * columnas, por eso es un interruptor y no el comportamiento por defecto.
   */
  atsMode?: boolean;
  /**
   * Idioma declarado del borrador (`auto|es|en`). Con `es`/`en` los encabezados
   * salen en ese idioma; con `auto` (o ausente) se detectan del contenido.
   */
  language?: "auto" | "es" | "en";
}

export interface ContactLink {
  type: string;
  url: string;
}

/** Datos de contacto/idiomas del perfil (no cambian por vacante). */
export interface ResumePdfProfile {
  name: string;
  /** Titular del perfil; en la carta aparece bajo la firma. */
  headline?: string[] | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  links?: ContactLink[];
  languages?: { language: string; level: string }[];
  /** Filas crudas por si el JSON no trae el shape esperado. */
  languagesJson?: unknown;
}

export interface ResumePdfData {
  content: ResumePdfContent;
  profile: ResumePdfProfile;
  /** QR ya renderizado a data URL (PNG) desde el navegador. */
  qrDataUrl?: string | null;
  /** Texto bajo el QR (la URL del portafolio). */
  qrLabel?: string | null;
}

export interface CoverLetterPdfData {
  profile: ResumePdfProfile;
  /** Texto completo de la carta; los párrafos van separados por línea vacía. */
  coverLetter: string;
  company?: string | null;
  vacancyTitle?: string | null;
  /** Fecha mostrada en la carta (por defecto, hoy). */
  date?: string;
}

/** Normaliza el JSON de idiomas del perfil a una lista tipada. */
export function readLanguages(profile: ResumePdfProfile): { language: string; level: string }[] {
  const raw = profile.languages ?? profile.languagesJson;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      language: String(item.language ?? '').trim(),
      level: String(item.level ?? '').trim(),
    }))
    .filter((item) => item.language.length > 0);
}

/**
 * URLs legibles para el bloque de contacto: prioriza el portafolio/sitio y el
 * GitHub, y evita repetir el email/teléfono (que ya van como campos propios).
 */
export function webLinks(profile: ResumePdfProfile): { label: string; url: string }[] {
  const links = profile.links ?? [];
  const preferred = ['website', 'portfolio', 'github', 'linkedin'];
  return links
    .filter((l) => l?.url && preferred.includes((l.type ?? '').toLowerCase()))
    .sort(
      (a, b) => preferred.indexOf(a.type.toLowerCase()) - preferred.indexOf(b.type.toLowerCase()),
    )
    .map((l) => ({
      label: prettyUrl(l.url),
      url: l.url,
    }));
}

export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/** El primer enlace del portafolio, que es el que codifica el QR. */
export function portfolioUrl(profile: ResumePdfProfile): string | null {
  const links = profile.links ?? [];
  const byType = (t: string) => links.find((l) => (l.type ?? '').toLowerCase() === t)?.url;
  return byType('website') ?? byType('portfolio') ?? byType('github') ?? null;
}

/**
 * El texto que un ATS usa para buscar palabras clave: el cuerpo de la HV, sin
 * el contacto. Refleja el mismo criterio que el medidor del API, para que el
 * usuario pueda ver POR QUÉ su score es el que es.
 */
export function resumeToAtsText(content: ResumePdfContent): string {
  const parts: string[] = [content.headline ?? '', content.summary ?? ''];
  parts.push(...(content.skills ?? []));
  for (const exp of content.experience ?? []) {
    parts.push(exp.role ?? '', exp.company ?? '', ...(exp.bullets ?? []));
  }
  for (const project of content.projects ?? []) {
    parts.push(project.name ?? '', ...(project.highlights ?? []));
  }
  for (const edu of content.education ?? []) parts.push(edu.degree ?? '', edu.institution ?? '');
  parts.push(...(content.softSkills ?? []));
  return parts.filter(Boolean).join('\n');
}

/** Parte la carta en párrafos, descartando líneas vacías. */
export function coverLetterParagraphs(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Fecha larga en español, sin depender del locale del navegador. */
export function formatLongDate(date = new Date()): string {
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}
