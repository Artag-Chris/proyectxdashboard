/**
 * Saneado de texto para el PDF.
 *
 * Las fuentes se descargaron como subsets *latin* de Google Fonts, que cubren
 * U+0020–U+00FF. Cualquier carácter fuera de ese rango (comillas curvas, guiones
 * largos, emojis) no tiene glifo y saldría en blanco o como caja. Por eso:
 *   1. se reemplaza la puntuación "tipográfica" por su equivalente ASCII, y
 *   2. se descarta lo que quede fuera del rango soportado.
 *
 * Resultado: nunca aparece un carácter roto, incluso con texto generado por IA.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/[\u2018\u2019\u201A\u201B\u2032]/g, "'"],
  [/[\u201C\u201D\u201E\u201F\u2033]/g, '"'],
  [/[\u2013\u2014\u2015\u2212]/g, '-'],
  [/[\u2026]/g, '...'],
  [/[\u2022\u25CF\u25AA\u2043]/g, '-'],
  [/[\u2192\u21D2]/g, '->'],
  [/[\u00A0\u2007\u2009\u200A\u202F\u205F\u3000]/g, ' '],
  [/[\u2039\u203A\u00AB\u00BB]/g, '"'],
  [/[\u20AC]/g, 'EUR'],
  [/[\u201E]/g, '"'],
  [/[\u02C6\u02DC]/g, ''],
];

export function sanitizeForPdf(input: unknown): string {
  if (input == null) return '';
  let text = String(input);
  for (const [pattern, replacement] of REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  // Conserva salto de línea, ASCII imprimible y Latin-1 (hasta U+00FF).
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '\n' || char === '\t') {
      out += char === '\t' ? ' ' : char;
    } else if (code === 0x20 || (code >= 0x21 && code <= 0x7e)) {
      out += char;
    } else if (code >= 0xa0 && code <= 0xff) {
      out += char;
    }
    // Fuera de rango: se descarta a propósito.
  }
  // Colapsa espacios múltiples que deja el reemplazo.
  return out.replace(/[ \t]{2,}/g, ' ');
}
