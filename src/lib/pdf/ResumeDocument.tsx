import { Document, Image, Link, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { PdfText } from './PdfText';
import { sanitizeForPdf } from './sanitize';
import { COLORS, FONTS, PAGE } from './tokens';
import {
  prettyUrl,
  readLanguages,
  webLinks,
  type ResumePdfData,
  type ResumePdfProfile,
} from './types';

/** Trazos de los iconos del bloque de contacto (viewBox 24x24, solo contorno). */
const ICONS: Record<string, string[]> = {
  mail: ['M2.5 5.5h19v13h-19z', 'M2.5 6.5 12 13l9.5-6.5'],
  phone: [
    'M6.2 3.5h3l1.4 4.2-2 1.4a12.8 12.8 0 0 0 5.9 5.9l1.4-2 4.2 1.4v3a2 2 0 0 1-2.1 2A16.2 16.2 0 0 1 4.2 5.6a2 2 0 0 1 2-2.1z',
  ],
  pin: [
    'M12 21.5s6.6-6 6.6-11.4a6.6 6.6 0 1 0-13.2 0C5.4 15.5 12 21.5 12 21.5z',
    'M12 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
  ],
  globe: [
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    'M3.4 9.4h17.2M3.4 14.6h17.2',
    'M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z',
  ],
};

function Icon({ name, size = 8 }: { name: keyof typeof ICONS | string; size?: number }) {
  const paths = ICONS[name] ?? [];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {paths.map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={COLORS.white} strokeWidth={1.7} />
      ))}
    </Svg>
  );
}

/** Datos de contacto ya resueltos, en el orden del CV original. */
function contactRows(profile: ResumePdfProfile) {
  const rows: { icon: string; label: string; url?: string }[] = [];
  if (profile.email) {
    rows.push({
      icon: 'mail',
      label: sanitizeForPdf(profile.email).toUpperCase(),
      url: `mailto:${profile.email}`,
    });
  }
  if (profile.phone) {
    rows.push({
      icon: 'phone',
      label: `CEL: ${sanitizeForPdf(profile.phone)}`,
      url: `tel:${String(profile.phone).replace(/[^\d+]/g, '')}`,
    });
  }
  if (profile.location) rows.push({ icon: 'pin', label: sanitizeForPdf(profile.location) });
  for (const web of webLinks(profile)) {
    rows.push({ icon: 'globe', label: prettyUrl(web.url), url: web.url });
  }
  return rows;
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{sanitizeForPdf(children).toUpperCase()}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

/** Viñeta dibujada como círculo: la fuente latin no trae glifos de viñeta. */
function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow} wrap={false}>
      <View style={styles.bulletDot} />
      <View style={styles.bulletTextWrap}>
        <PdfText text={sanitizeForPdf(children)} style={styles.bulletText} />
      </View>
    </View>
  );
}

export function ResumeDocument({ data }: { data: ResumePdfData }) {
  const { content, profile, qrDataUrl, qrLabel } = data;
  const name = sanitizeForPdf(profile.name || 'Hoja de vida');
  const headline = sanitizeForPdf(content.headline ?? '');
  const summary = sanitizeForPdf(content.summary ?? '');
  const experience = content.experience ?? [];
  const education = content.education ?? [];
  const skills = (content.skills ?? []).filter(Boolean);
  const softSkills = (content.softSkills ?? []).filter(Boolean);
  const projects = (content.projects ?? []).filter((p) => p?.name);
  const languages = readLanguages(profile);
  const contacts = contactRows(profile);

  return (
    <Document
      title={`${name} - Hoja de vida`}
      author={name}
      subject="Hoja de vida"
      creator="CV Harness"
    >
      {/* ── Página 1: perfil, experiencia cronológica, formación y QR ── */}
      <Page size={PAGE.size} style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.name}>{name}</Text>
              <View style={styles.nameRule} />
              {headline ? <Text style={styles.headline}>{headline}</Text> : null}
            </View>
            <View style={styles.headerRight}>
              {contacts.map((row, i) => (
                <View key={i} style={styles.contactRow} wrap={false}>
                  <View style={styles.contactIcon}>
                    <Icon name={row.icon} />
                  </View>
                  {row.url ? (
                    <Link src={row.url} style={styles.contactText}>
                      {row.label}
                    </Link>
                  ) : (
                    <Text style={styles.contactText}>{row.label}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.columns}>
            <View style={styles.mainCol}>
              {summary ? (
                <View>
                  <SectionTitle>About me</SectionTitle>
                  <PdfText text={summary} style={styles.paragraph} />
                </View>
              ) : null}

              {experience.length > 0 ? (
                <View>
                  <SectionTitle>Work experience in time</SectionTitle>
                  {experience.map((exp, i) => (
                    <View key={i} style={styles.expItem} wrap={false}>
                      <Text style={styles.expMeta}>
                        {exp.period ? (
                          <Text style={styles.expPeriod}>{sanitizeForPdf(exp.period)}</Text>
                        ) : null}
                        {exp.period && exp.company ? ' | ' : ''}
                        {sanitizeForPdf(exp.company ?? '')}
                      </Text>
                      <Text style={styles.expRole}>{sanitizeForPdf(exp.role ?? '')}</Text>
                      {(exp.bullets ?? []).slice(0, 3).map((b, j) => (
                        <PdfText key={j} text={sanitizeForPdf(b)} style={styles.expBullet} />
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}

              {languages.length > 0 ? (
                <View>
                  <SectionTitle>Languages</SectionTitle>
                  {languages.map((lang, i) => (
                    <Text key={i} style={styles.langRow}>
                      <Text style={styles.langName}>{sanitizeForPdf(lang.language)}</Text>
                      {lang.level ? ` ${sanitizeForPdf(lang.level)}` : ''}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.sideCol}>
              {education.length > 0 ? (
                <View>
                  <SectionTitle>Academic background</SectionTitle>
                  {education.map((edu, i) => (
                    <View key={i} style={styles.eduItem} wrap={false}>
                      {edu.period ? (
                        <Text style={styles.eduPeriod}>{sanitizeForPdf(edu.period)}</Text>
                      ) : null}
                      <Text style={styles.eduDegree}>{sanitizeForPdf(edu.degree ?? '')}</Text>
                      <Text style={styles.eduPlace}>
                        {sanitizeForPdf(edu.institution ?? '')}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {qrDataUrl ? (
                <View style={styles.qrBlock} wrap={false}>
                  {/* El <Image> de react-pdf no acepta `alt` (no es un <img> del DOM). */}
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={qrDataUrl} style={styles.qrImage} />
                  <Text style={styles.qrLabel}>
                    {sanitizeForPdf(qrLabel ?? '')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {skills.length > 0 ? (
            <View>
              <SectionTitle>Technical skills</SectionTitle>
              <View style={styles.skillGrid}>
                {skills.map((skill, i) => (
                  <Text key={i} style={styles.skillItem}>
                    {sanitizeForPdf(skill)}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          {softSkills.length > 0 ? (
            <View>
              <SectionTitle>Soft skills</SectionTitle>
              {softSkills.map((skill, i) => (
                <Bullet key={i}>{skill}</Bullet>
              ))}
            </View>
          ) : null}
        </View>
      </Page>

      {/* ── Páginas siguientes: proyectos como casos de estudio ── */}
      {projects.length > 0 ? (
        <Page size={PAGE.size} style={styles.page}>
          <View style={styles.plainHeader}>
            <Text style={styles.plainName}>{name}</Text>
            <Text style={styles.plainMeta}>
              {[profile.email, profile.phone, profile.location]
                .filter(Boolean)
                .map((v) => sanitizeForPdf(v))
                .join('  ·  ')}
            </Text>
            <View style={styles.plainRule} />
          </View>
          <View style={styles.body}>
            <SectionTitle>Work experience</SectionTitle>
            {projects.map((project, i) => (
              <View key={i} style={styles.projectBlock}>
                <Text style={styles.projectName}>
                  {sanitizeForPdf(project.name ?? '').toUpperCase()}
                </Text>
                {(project.highlights ?? []).map((h, j) => (
                  <Bullet key={j}>{h}</Bullet>
                ))}
              </View>
            ))}
          </View>
          <View style={styles.footerRule} fixed />
        </Page>
      ) : null}
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.white,
    paddingBottom: PAGE.paddingBottom,
    fontFamily: FONTS.body,
    fontSize: 9,
    color: COLORS.body,
  },
  header: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: PAGE.paddingX,
    paddingTop: 26,
    paddingBottom: 22,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  // El bloque izquierdo cede ancho antes que el contacto (que no debe cortarse
  // a mitad de una URL): flexShrink + un colchón de separación explícito.
  headerLeft: { flexGrow: 1, flexShrink: 1, paddingRight: 22 },
  headerRight: { width: 158, flexShrink: 0, alignItems: 'flex-start' },
  name: {
    fontFamily: FONTS.display,
    fontSize: 25,
    color: COLORS.white,
    letterSpacing: 0.4,
  },
  nameRule: {
    height: 1,
    width: 120,
    backgroundColor: COLORS.white,
    marginTop: 6,
    marginBottom: 6,
    opacity: 0.85,
  },
  headline: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9.4,
    color: COLORS.white,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    lineHeight: 1.3,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  contactIcon: { width: 11, marginRight: 5 },
  contactText: {
    fontFamily: FONTS.mono,
    fontSize: 7.6,
    color: COLORS.white,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: PAGE.paddingX,
    paddingTop: PAGE.paddingTop,
  },
  columns: { flexDirection: 'row' },
  mainCol: { flexGrow: 1.95, flexShrink: 1, paddingRight: 20 },
  sideCol: { flexGrow: 1, flexShrink: 1, paddingLeft: 20, borderLeftWidth: 0.7, borderLeftColor: COLORS.ruleSoft },
  sectionTitleWrap: { marginTop: 16, marginBottom: 8 },
  sectionTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    color: COLORS.ink,
    letterSpacing: 1.7,
  },
  sectionRule: {
    height: 1.1,
    backgroundColor: COLORS.rule,
    marginTop: 5,
  },
  paragraph: {
    fontFamily: FONTS.body,
    fontSize: 9.3,
    lineHeight: 1.5,
    textAlign: 'justify',
    color: COLORS.body,
  },
  expItem: { marginBottom: 9 },
  expMeta: { fontSize: 9.2, color: COLORS.ink, fontFamily: FONTS.bodyBold },
  expPeriod: { fontFamily: FONTS.bodyBold },
  expRole: { fontFamily: FONTS.body, fontSize: 9.2, marginTop: 1, color: COLORS.body },
  expBullet: {
    fontFamily: FONTS.body,
    fontSize: 8.6,
    marginTop: 2,
    color: COLORS.muted,
    lineHeight: 1.35,
  },
  langRow: { fontFamily: FONTS.body, fontSize: 9.2, marginBottom: 2, color: COLORS.body },
  langName: { fontFamily: FONTS.bodyBold, color: COLORS.ink },
  eduItem: { marginBottom: 8 },
  eduPeriod: { fontSize: 8.6, fontFamily: FONTS.bodyBold, color: COLORS.ink },
  eduDegree: { fontFamily: FONTS.body, fontSize: 9, marginTop: 1, color: COLORS.body },
  eduPlace: { fontFamily: FONTS.body, fontSize: 8.4, color: COLORS.muted, marginTop: 1 },
  qrBlock: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 0.7,
    borderTopColor: COLORS.ruleSoft,
    alignItems: 'center',
  },
  qrImage: { width: 92, height: 92 },
  qrLabel: {
    marginTop: 6,
    fontFamily: FONTS.mono,
    fontSize: 7.2,
    color: COLORS.muted,
    textAlign: 'center',
  },
  skillGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  skillItem: {
    fontFamily: FONTS.body,
    width: '50%',
    fontSize: 8.8,
    paddingRight: 10,
    marginBottom: 3.5,
    color: COLORS.body,
    lineHeight: 1.35,
  },
  bulletRow: { flexDirection: 'row', marginBottom: 3.5, paddingRight: 6 },
  bulletDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.ink,
    marginTop: 4.4,
    marginRight: 6,
  },
  bulletTextWrap: { flexGrow: 1, flexShrink: 1 },
  bulletText: {
    fontFamily: FONTS.body,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 8.8,
    lineHeight: 1.42,
    color: COLORS.body,
  },
  plainHeader: { paddingHorizontal: PAGE.paddingX, paddingTop: 26 },
  plainName: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: COLORS.ink,
    letterSpacing: 0.3,
  },
  plainMeta: { fontFamily: FONTS.mono, fontSize: 7.4, color: COLORS.muted, marginTop: 3 },
  plainRule: { height: 1.1, backgroundColor: COLORS.ink, marginTop: 8 },
  projectBlock: { marginBottom: 12 },
  projectName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9.4,
    color: COLORS.ink,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  footerRule: {
    position: 'absolute',
    bottom: 28,
    left: PAGE.paddingX,
    right: PAGE.paddingX,
    height: 0.8,
    backgroundColor: COLORS.ruleSoft,
  },
});
