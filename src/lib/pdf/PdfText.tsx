import { Text } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';

/**
 * Texto que puede contener saltos de línea internos.
 *
 * react-pdf NO maneja bien un `\n` dentro de un `<Text>`: al partirlo, uno de
 * los segmentos pierde la fuente declarada y cae a Helvetica (no embebida), lo
 * que rompe la fidelidad del PDF. Aquí cada línea se emite como su propio
 * `<Text>`, heredando siempre el estilo recibido.
 */
export function PdfText({ text, style }: { text: string; style?: Style | Style[] }) {
  const value = String(text ?? '');
  const lines = value.split('\n');
  if (lines.length === 1) return <Text style={style}>{value}</Text>;
  return (
    <>
      {lines.map((line, i) => (
        <Text key={i} style={style}>
          {line}
        </Text>
      ))}
    </>
  );
}
