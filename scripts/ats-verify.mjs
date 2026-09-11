/**
 * Guardián de parseabilidad del PDF para ATS.
 *
 * Extrae el texto de los PDF ya generados por `pdf:check` y comprueba que un
 * parser real (pdftotext, de la familia de poppler) vea lo que debe ver. Existe
 * porque el modo de falla es SILENCIOSO: un `letterSpacing` en los títulos hacía
 * que "PROYECTOS" saliera como "P R OY EC TO S" y un ATS dejaba de reconocer la
 * sección, sin que nada fallara.
 *
 *   npm run pdf:check -- <dir> && node scripts/ats-verify.mjs <dir>
 *
 * Si no está poppler, avisa y no rompe (la verificación es opcional).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const dir = process.argv[2] ?? '.';
const failures = [];

function pdftotext(file) {
  return execFileSync('pdftotext', [file, '-'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

/** Encabezados que un ATS tiene que reconocer en el modo ATS. */
const ATS_HEADINGS = [
  'PERFIL PROFESIONAL',
  'EXPERIENCIA PROFESIONAL',
  'PROYECTOS',
  'HABILIDADES',
  'EDUCACIÓN',
  'IDIOMAS',
  'HABILIDADES BLANDAS',
];

/** Encabezados que NO deben aparecer en modo ATS (los heredados). */
const LEGACY_ONLY = ['ABOUT ME', 'ACADEMIC BACKGROUND', 'WORK EXPERIENCE IN TIME'];

function check(condition, message) {
  if (!condition) failures.push(message);
}

let atsText = '';
let legacyText = '';
try {
  atsText = pdftotext(path.join(dir, 'cv-sample-ats.pdf'));
  legacyText = pdftotext(path.join(dir, 'cv-sample.pdf'));
} catch (error) {
  const reason = error?.code === 'ENOENT' ? 'no está instalado poppler (pdftotext)' : String(error);
  process.stdout.write(`ATS_SKIP: ${reason}\n`);
  process.exit(0);
}

// 1. Los encabezados estándar tienen que extraerse LETRA A LETRA completos.
for (const heading of ATS_HEADINGS) {
  check(atsText.includes(heading), `el modo ATS no expone el encabezado "${heading}"`);
}

// 2. Y en orden lineal: el orden extraído debe seguir el del documento.
const positions = ATS_HEADINGS.map((h) => atsText.indexOf(h)).filter((i) => i >= 0);
const sorted = [...positions].sort((a, b) => a - b);
check(
  JSON.stringify(positions) === JSON.stringify(sorted),
  `los encabezados del modo ATS salen desordenados: ${positions.join(', ')}`,
);

// 3. Ningún encabezado puede salir con espacios metidos dentro de la palabra.
const mangled = ['P R OY EC TO S', 'E X P E R I E N C I A', 'H A B I L I D A D E S'].find((frag) =>
  atsText.includes(frag),
);
check(!mangled, `un encabezado sale troceado al extraerlo ("${mangled}")`);

// 4. El modo heredado conserva sus encabezados y NO usa los estándar.
for (const heading of LEGACY_ONLY) {
  check(legacyText.includes(heading), `el modo heredado perdió el encabezado "${heading}"`);
}

// 5. Contacto: en modo ATS el email debe ser reconocible por regex y el teléfono
//    no debe llevar el prefijo "CEL:".
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE = /\+?\d[\d\s().-]{7,}\d/;
check(EMAIL.test(atsText), 'el modo ATS no expone un email reconocible por regex');
check(PHONE.test(atsText), 'el modo ATS no expone un teléfono reconocible por regex');
check(!atsText.includes('CEL:'), 'el modo ATS conserva el prefijo "CEL:"');
check(
  (atsText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/) ?? []).length === 0,
  'el modo ATS imprime el email en mayúsculas',
);
check(legacyText.includes('CEL:'), 'el modo heredado debería conservar el prefijo "CEL:"');

if (failures.length > 0) {
  process.stderr.write(`ATS_FAIL (${failures.length}):\n`);
  for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  process.exit(1);
}
process.stdout.write('ATS_OK\n');
