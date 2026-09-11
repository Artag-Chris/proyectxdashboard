/**
 * Hook de resolución SOLO para el script de verificación (ver pdf-loader.mjs).
 *
 * `@react-pdf/hyphenate` es ESM-only: su `exports` no define la condición
 * "require", pero `@react-pdf/textkit` (CJS) hace `require()` de él. Fuera de un
 * bundler (es decir, en Node a secas) eso lanza ERR_PACKAGE_PATH_NOT_EXPORTED y
 * react-pdf no arranca. Aquí se apunta al archivo real.
 *
 * Next no necesita esto: su bundler resuelve el subpaquete sin problema.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@react-pdf/hyphenate/en-us') {
    return {
      url: pathToFileURL(
        path.join(root, 'node_modules', '@react-pdf', 'hyphenate', 'lib', 'en-us.js'),
      ).href,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
