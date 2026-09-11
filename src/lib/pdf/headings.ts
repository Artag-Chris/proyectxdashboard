/**
 * Encabezados estándar que reconoce un ATS, y detección de idioma.
 *
 * IMPORTANTE: este mapa está DUPLICADO en la API
 * (`apps/api/src/modules/ats/headings.ts`) porque son repos separados y no hay
 * import cruzado. Si se cambia acá y no allá, el medidor de ATS dejaría de
 * reflejar el PDF; los tests del API fijan el contrato para que se note.
 */
export type AtsLanguage = 'es' | 'en';

export const STANDARD_HEADINGS: Record<AtsLanguage, Record<string, string>> = {
  en: {
    summary: 'Professional summary',
    experience: 'Professional experience',
    skills: 'Skills',
    education: 'Education',
    projects: 'Projects',
    languages: 'Languages',
    softSkills: 'Soft skills',
  },
  es: {
    summary: 'Perfil profesional',
    experience: 'Experiencia profesional',
    skills: 'Habilidades',
    education: 'Educación',
    projects: 'Proyectos',
    languages: 'Idiomas',
    softSkills: 'Habilidades blandas',
  },
};

const ES_MARKERS = [' y ', ' de ', ' con ', ' para ', ' que ', ' en ', ' la ', ' el ', ' los ', ' las '];
const EN_MARKERS = [' and ', ' of ', ' with ', ' for ', ' the ', ' in ', ' to ', ' is ', ' are '];

/**
 * Idioma del contenido por marcadores de función. Empata a español, que es el
 * idioma por defecto del harness.
 */
export function detectLanguage(...texts: (string | null | undefined)[]): AtsLanguage {
  const haystack = ` ${texts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')} `;
  const count = (markers: string[]) =>
    markers.reduce((total, marker) => total + haystack.split(marker).length - 1, 0);
  return count(EN_MARKERS) > count(ES_MARKERS) ? 'en' : 'es';
}
