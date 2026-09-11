import { Font } from '@react-pdf/renderer';
import { FONTS } from './tokens';

/**
 * Registro de las fuentes del CV. Los TTF viven en `dashboard/public/fonts/`
 * (subsets latin de Google Fonts, licencia OFL).
 *
 * `base` permite que el mismo registro sirva en el navegador (rutas absolutas
 * de la web) y en el script de verificación en Node (rutas del disco), que
 * necesita comprobar el PDF sin abrir un navegador.
 *
 * Es idempotente: react-pdf lanza si se registra dos veces la misma familia.
 */
let registered = false;

export function registerFonts(base = ''): void {
  if (registered) return;
  registered = true;

  const src = (file: string) => `${base}/fonts/${file}`;

  Font.register({ family: FONTS.display, src: src('questrial-400.ttf') });
  Font.register({ family: FONTS.body, src: src('raleway-400.ttf') });
  Font.register({ family: FONTS.bodyBold, src: src('raleway-700.ttf') });
  Font.register({ family: FONTS.mono, src: src('roboto-400.ttf') });

  // Sin guionado automático: react-pdf parte palabras largas por defecto y en un
  // CV (URLs, tecnologías) queda mal.
  Font.registerHyphenationCallback((word) => [word]);
}
