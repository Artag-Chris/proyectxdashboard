import { Document, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { PdfText } from './PdfText';
import { sanitizeForPdf } from './sanitize';
import { COLORS, FONTS, PAGE } from './tokens';
import {
  coverLetterParagraphs,
  formatLongDate,
  prettyUrl,
  webLinks,
  type CoverLetterPdfData,
} from './types';

export function CoverLetterDocument({ data }: { data: CoverLetterPdfData }) {
  const { profile, coverLetter, company, vacancyTitle } = data;
  const name = sanitizeForPdf(profile.name || '');
  const paragraphs = coverLetterParagraphs(sanitizeForPdf(coverLetter));
  const date = sanitizeForPdf(data.date ?? formatLongDate());
  const contact = [profile.email, profile.phone, profile.location]
    .filter(Boolean)
    .map((v) => sanitizeForPdf(v))
    .join('  ·  ');
  const webs = webLinks(profile);

  return (
    <Document
      title={`Carta de presentación - ${name}`}
      author={name}
      subject={vacancyTitle ? `Postulación: ${vacancyTitle}` : 'Carta de presentación'}
      creator="CV Harness"
    >
      <Page size={PAGE.size} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{name}</Text>
          {contact ? <Text style={styles.contact}>{contact}</Text> : null}
          {webs.length > 0 ? (
            <View style={styles.webRow}>
              {webs.map((web, i) => (
                <Link key={i} src={web.url} style={styles.webLink}>
                  {prettyUrl(web.url)}
                </Link>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.date}>{date}</Text>

          <View style={styles.recipient}>
            <Text style={styles.recipientLine}>
              {company ? `Equipo de ${sanitizeForPdf(company)}` : 'Equipo de selección'}
            </Text>
            {vacancyTitle ? (
              <Text style={styles.recipientMeta}>
                Ref: {sanitizeForPdf(vacancyTitle)}
              </Text>
            ) : null}
          </View>

          <Text style={styles.greeting}>
            {company ? 'Estimado equipo de ' + sanitizeForPdf(company) + ':' : 'Estimado equipo de selección:'}
          </Text>

          {paragraphs.map((paragraph, i) => (
            <View key={i} style={styles.paragraphBlock}>
              <PdfText text={paragraph} style={styles.paragraph} />
            </View>
          ))}

          <View style={styles.signature} wrap={false}>
            <Text style={styles.signatureName}>{name}</Text>
            {profile.headline?.[0] ? (
              <Text style={styles.signatureMeta}>{sanitizeForPdf(profile.headline[0])}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.footerRule} fixed />
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.white,
    // Padding superior en todas las páginas: si la carta pasa a una segunda,
    // el texto no arranca pegado al borde de la hoja.
    paddingTop: PAGE.paddingTop,
    paddingBottom: PAGE.paddingBottom,
    fontFamily: FONTS.body,
    fontSize: 10,
    color: COLORS.body,
  },
  header: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: PAGE.paddingX,
    paddingTop: 26,
    paddingBottom: 20,
    // Compensa el padding de la página: la banda sigue pegada al borde.
    marginTop: -PAGE.paddingTop,
  },
  name: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.white, letterSpacing: 0.4 },
  contact: {
    fontFamily: FONTS.mono,
    fontSize: 8.2,
    color: COLORS.white,
    marginTop: 7,
    letterSpacing: 0.3,
  },
  webRow: { flexDirection: 'row', marginTop: 5 },
  webLink: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.white, marginRight: 12 },
  body: { paddingHorizontal: PAGE.paddingX, paddingTop: 26 },
  // fontFamily explícito en TODOS los estilos de texto: si un Text no la
  // declara, react-pdf cae a Helvetica (no embebida) y el PDF pierde fidelidad.
  date: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.muted },
  recipient: { marginTop: 20, marginBottom: 18 },
  recipientLine: { fontFamily: FONTS.bodyBold, fontSize: 10.5, color: COLORS.ink },
  recipientMeta: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.muted, marginTop: 3 },
  greeting: { fontFamily: FONTS.body, fontSize: 10.5, color: COLORS.ink, marginBottom: 12 },
  // marginBottom va en el contenedor: cada línea del párrafo es un Text propio
  // (ver PdfText) y no debe acumular espacio entre líneas.
  paragraphBlock: { marginBottom: 11 },
  paragraph: {
    fontFamily: FONTS.body,
    fontSize: 10,
    lineHeight: 1.55,
    textAlign: 'justify',
    color: COLORS.body,
  },
  signature: { marginTop: 18, paddingTop: 12, borderTopWidth: 0.8, borderTopColor: COLORS.ruleSoft },
  signatureName: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.ink },
  signatureMeta: { fontFamily: FONTS.body, fontSize: 8.6, color: COLORS.muted, marginTop: 3 },
  footerRule: {
    position: 'absolute',
    bottom: 28,
    left: PAGE.paddingX,
    right: PAGE.paddingX,
    height: 0.8,
    backgroundColor: COLORS.ruleSoft,
  },
});
