/**
 * Registra el hook de resolución para el script de verificación de PDFs.
 * Se usa con NODE_OPTIONS="--import ./scripts/pdf-loader.mjs".
 */
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(here, 'pdf-resolve.mjs')));
