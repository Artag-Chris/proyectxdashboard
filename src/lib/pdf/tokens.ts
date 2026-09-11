/**
 * Tokens visuales extraídos del CV original (Christian_resume.pdf).
 *
 * Los colores salen de muestrear los píxeles del PDF original: el header es
 * #413C40 (gris carbón), el cuerpo de texto #222222 y las líneas finas bajo
 * cada título #A3ABB8.
 */
export const COLORS = {
  /** Fondo de la banda del header y color de los títulos. */
  ink: '#413C40',
  /** Texto de párrafos. */
  body: '#222222',
  /** Texto secundario (periodos, etiquetas, pie de la QR). */
  muted: '#6E7076',
  /** Línea fina bajo los títulos de sección. */
  rule: '#A3ABB8',
  /** Separadores internos muy suaves. */
  ruleSoft: '#D9DCE1',
  white: '#FFFFFF',
  /** Fondo suave para la tarjeta del QR. */
  surface: '#F2F3F5',
} as const;

/**
 * Familias registradas en `register-fonts.ts`. Questrial (geométrica) se usa
 * para el nombre y los títulos; Raleway para el cuerpo; Roboto para el bloque
 * de contacto — la misma mezcla del PDF original.
 */
export const FONTS = {
  display: 'Questrial',
  body: 'Raleway',
  bodyBold: 'Raleway-Bold',
  mono: 'Roboto',
} as const;

export const PAGE = {
  paddingX: 44,
  paddingTop: 34,
  paddingBottom: 46,
  size: 'A4' as const,
};
