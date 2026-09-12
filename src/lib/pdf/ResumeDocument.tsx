import { Document, Image, Link, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { detectLanguage, STANDARD_HEADINGS } from './headings';
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

/**
 * Datos de contacto. En Modo ATS el email va en minúsculas y el teléfono sin el
 * prefijo "CEL: ": son las dos cosas que un parser de ATS lee mal.
 */
function contactRows(profile: ResumePdfProfile, atsMode: boolean) {
  const rows: { icon: string; label: string; url?: string }[] = [];
  if (profile.email) {
    const email = sanitizeForPdf(profile.email);
    rows.push({
      icon: 'mail',
      label: atsMode ? email.toLowerCase() : email.toUpperCase(),
      url: `mailto:${profile.email}`,
    });
  }
  if (profile.phone) {
    const phone = sanitizeForPdf(profile.phone);
    rows.push({
      icon: 'phone',
      label: atsMode ? phone : `CEL: ${phone}`,
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

/**
 * Titular del header. Se ocupa de que un titular largo NUNCA se monte sobre el
 * bloque de contacto:
 *  1. lo parte en los separadores naturales (`|`, `·`, `•`) para que use varias
 *     líneas parejas en vez de una sola que se desborda, y
 *  2. lo pasa a MAYÚSCULAS aquí —no con `textTransform`— y sin `letterSpacing`,
 *     porque react-pdf mide el ancho del texto SIN transformar y sin tracking:
 *     "cabía" en su cálculo pero se dibujaba más ancho y pisaba la columna
 *     derecha. Midir == dibujar es lo que hace que el wrap sea correcto.
 */
function buildHeadline(raw: string): string {
  return raw
    .split(/[|•·]/)
    .map((part) => sanitizeForPdf(part).trim())
    .filter(Boolean)
    .join('\n')
    .toUpperCase();
}

/** Viñeta dibujada como círculo: la fuente latin no trae glifos de viñeta. */
function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <View style={styles.bulletTextWrap}>
        <PdfText text={sanitizeForPdf(children)} style={styles.bulletText} />
      </View>
    </View>
  );
}

function SummarySection({ text, heading }: { text: string; heading: string }) {
  if (!text) return null;
  return (
    <View>
      <SectionTitle>{heading}</SectionTitle>
      <PdfText text={text} style={styles.paragraph} />
    </View>
  );
}

function ExperienceSection({
  experience,
  heading,
}: {
  experience: NonNullable<ResumePdfData['content']['experience']>;
  heading: string;
}) {
  if (experience.length === 0) return null;
  return (
    <View>
      <SectionTitle>{heading}</SectionTitle>
      {experience.map((exp, i) => (
        <View key={i} style={styles.expItem}>
          <Text style={styles.expMeta}>
            {exp.period ? (
              <Text style={styles.expPeriod}>{sanitizeForPdf(exp.period)}</Text>
            ) : null}
            {exp.period && exp.company ? ' | ' : ''}
            {sanitizeForPdf(exp.company ?? '')}
          </Text>
          <Text style={styles.expRole}>{sanitizeForPdf(exp.role ?? '')}</Text>
          {(exp.bullets ?? []).map((b, j) => (
            <PdfText key={j} text={sanitizeForPdf(b)} style={styles.expBullet} />
          ))}
        </View>
      ))}
    </View>
  );
}

function ProjectsSection({
  projects,
  heading,
}: {
  projects: NonNullable<ResumePdfData['content']['projects']>;
  heading: string;
}) {
  if (projects.length === 0) return null;
  return (
    <View>
      <SectionTitle>{heading}</SectionTitle>
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
  );
}

function SkillsSection({
  skills,
  heading,
  inline,
}: {
  skills: string[];
  heading: string;
  /** En Modo ATS van en una línea separadas por comas (lo más legible por un parser). */
  inline: boolean;
}) {
  if (skills.length === 0) return null;
  return (
    <View>
      <SectionTitle>{heading}</SectionTitle>
      {inline ? (
        <Text style={styles.skillsInline}>{skills.map((s) => sanitizeForPdf(s)).join(', ')}</Text>
      ) : (
        <View style={styles.skillGrid}>
          {skills.map((skill, i) => (
            <Text key={i} style={styles.skillItem}>
              {sanitizeForPdf(skill)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function EducationSection({
  education,
  heading,
}: {
  education: NonNullable<ResumePdfData['content']['education']>;
  heading: string;
}) {
  if (education.length === 0) return null;
  return (
    <View>
      <SectionTitle>{heading}</SectionTitle>
      {education.map((edu, i) => (
        <View key={i} style={styles.eduItem}>
          {edu.period ? (
            <Text style={styles.eduPeriod}>{sanitizeForPdf(edu.period)}</Text>
          ) : null}
          <Text style={styles.eduDegree}>{sanitizeForPdf(edu.degree ?? '')}</Text>
          <Text style={styles.eduPlace}>{sanitizeForPdf(edu.institution ?? '')}</Text>
        </View>
      ))}
    </View>
  );
}

function LanguagesSection({
  languages,
  heading,
}: {
  languages: { language: string; level: string }[];
  heading: string;
}) {
  if (languages.length === 0) return null;
  return (
    <View>
      <SectionTitle>{heading}</SectionTitle>
      {languages.map((lang, i) => (
        <Text key={i} style={styles.langRow}>
          <Text style={styles.langName}>{sanitizeForPdf(lang.language)}</Text>
          {lang.level ? ` ${sanitizeForPdf(lang.level)}` : ''}
        </Text>
      ))}
    </View>
  );
}

function SoftSkillsSection({ softSkills, heading }: { softSkills: string[]; heading: string }) {
  if (softSkills.length === 0) return null;
  return (
    <View>
      <SectionTitle>{heading}</SectionTitle>
      {softSkills.map((skill, i) => (
        <Bullet key={i}>{skill}</Bullet>
      ))}
    </View>
  );
}

function QrBlock({ qrDataUrl, qrLabel }: { qrDataUrl?: string | null; qrLabel?: string | null }) {
  if (!qrDataUrl) return null;
  return (
    <View style={styles.qrBlock}>
      {/* El <Image> de react-pdf no acepta `alt` (no es un <img> del DOM). */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={qrDataUrl} style={styles.qrImage} />
      <Text style={styles.qrLabel}>{sanitizeForPdf(qrLabel ?? '')}</Text>
    </View>
  );
}

export function ResumeDocument({ data }: { data: ResumePdfData }) {
  const { content, profile, qrDataUrl, qrLabel } = data;
  const atsMode = content.atsMode === true;
  const name = sanitizeForPdf(profile.name || 'Hoja de vida');
  const headline = sanitizeForPdf(content.headline ?? '');
  // Titular visible: mayúsculas + partido por separadores (ver buildHeadline).
  const headlineDisplay = buildHeadline(content.headline ?? '');
  const summary = sanitizeForPdf(content.summary ?? '');
  const experience = content.experience ?? [];
  const education = content.education ?? [];
  const skills = (content.skills ?? []).filter(Boolean);
  const softSkills = (content.softSkills ?? []).filter(Boolean);
  const projects = (content.projects ?? []).filter((p) => p?.name);
  const languages = readLanguages(profile);
  const contacts = contactRows(profile, atsMode);

  // Los encabezados siguen el idioma del contenido (una vacante en inglés lleva
  // el CV en inglés, y el ATS de esa empresa busca encabezados en inglés).
  const headings = STANDARD_HEADINGS[
    detectLanguage(content.summary, content.headline, ...(content.skills ?? []))
  ];

  return (
    <Document
      title={`${name} - Hoja de vida`}
      author={name}
      subject="Hoja de vida"
      creator="CV Harness"
    >
      {/*
        Una sola página en flujo continuo: react-pdf salta a la siguiente cuando
        el contenido no cabe (antes eran dos páginas fijas y la segunda quedaba
        casi vacía).
      */}
      <Page size={PAGE.size} style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.name}>{name}</Text>
              <View style={styles.nameRule} />
              {headlineDisplay ? (
                <PdfText text={headlineDisplay} style={styles.headline} />
              ) : null}
            </View>
            <View style={styles.headerRight}>
              {contacts.map((row, i) => (
                <View key={i} style={styles.contactRow}>
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
          {atsMode ? (
            /*
              Modo ATS: una sola columna y orden lineal. Es lo que hace que el
              texto extraído siga el orden del documento, en vez de leer toda la
              columna izquierda y recién después la derecha.
            */
            <View>
              <SummarySection text={summary} heading={headings.summary} />
              <ExperienceSection experience={experience} heading={headings.experience} />
              <ProjectsSection projects={projects} heading={headings.projects} />
              <SkillsSection skills={skills} heading={headings.skills} inline />
              <EducationSection education={education} heading={headings.education} />
              <LanguagesSection languages={languages} heading={headings.languages} />
              <SoftSkillsSection softSkills={softSkills} heading={headings.softSkills} />
              <QrBlock qrDataUrl={qrDataUrl} qrLabel={qrLabel} />
            </View>
          ) : (
            <>
              <View style={styles.columns}>
                <View style={styles.mainCol}>
                  <SummarySection text={summary} heading="About me" />
                  <ExperienceSection
                    experience={experience}
                    heading="Work experience in time"
                  />
                  <LanguagesSection languages={languages} heading="Languages" />
                </View>

                <View style={styles.sideCol}>
                  <EducationSection education={education} heading="Academic background" />
                  <SoftSkillsSection softSkills={softSkills} heading="Soft skills" />
                  <QrBlock qrDataUrl={qrDataUrl} qrLabel={qrLabel} />
                </View>
              </View>

              <SkillsSection skills={skills} heading="Technical skills" inline={false} />
              <ProjectsSection projects={projects} heading="Work experience" />
            </>
          )}
        </View>

        {/* Pie en todas las páginas: regla fina + nombre y numeración. */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRule} />
          <View style={styles.footerRow}>
            <Text style={styles.footerName}>{name}</Text>
            <Text
              style={styles.footerPage}
              render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            />
          </View>
        </View>
      </Page>
    </Document>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.white,
    // El paddingTop se aplica en TODAS las páginas: sin él, el contenido que
    // salta a la página 2 arrancaba pegado al borde superior (y=0).
    paddingTop: PAGE.paddingTop,
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
    // Compensa el paddingTop de la página: así la banda oscura sigue llegando
    // al borde de la hoja solo en la primera página.
    marginTop: -PAGE.paddingTop,
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
    // SIN letterSpacing ni textTransform: react-pdf no los descuenta al medir el
    // ancho y un titular largo se montaba sobre el bloque de contacto. Las
    // mayúsculas se aplican al propio texto en `buildHeadline`.
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
  },
  // Anchos explícitos en %: con flexGrow el texto del cuerpo se desbordaba
  // sobre la columna derecha (se veía un texto encima de otro).
  columns: { flexDirection: 'row' },
  mainCol: { width: '62%', paddingRight: 18 },
  sideCol: {
    width: '38%',
    paddingLeft: 18,
    borderLeftWidth: 0.7,
    borderLeftColor: COLORS.ruleSoft,
  },
  sectionTitleWrap: { marginTop: 15, marginBottom: 7 },
  sectionTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10.5,
    color: COLORS.ink,
    // SIN letterSpacing a propósito: el tracking hace que un extractor de texto
    // (pdftotext y los parsers de los ATS) meta espacios DENTRO de la palabra
    // ("P R OY EC TO S") y deje de reconocer la sección. Verificado sobre el PDF.
    letterSpacing: 0,
  },
  sectionRule: {
    height: 1.1,
    backgroundColor: COLORS.rule,
    marginTop: 5,
  },
  // Sin `justify`: el CV original va alineado a la izquierda y justificar en
  // react-pdf desbordaba el ancho de la columna.
  paragraph: {
    fontFamily: FONTS.body,
    fontSize: 9.3,
    lineHeight: 1.5,
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
    marginTop: 16,
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
  skillsInline: {
    fontFamily: FONTS.body,
    fontSize: 9,
    lineHeight: 1.45,
    color: COLORS.body,
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
  bulletTextWrap: { flexGrow: 1, flexShrink: 1, width: '96%' },
  bulletText: {
    fontFamily: FONTS.body,
    fontSize: 8.8,
    lineHeight: 1.42,
    color: COLORS.body,
  },
  projectBlock: { marginBottom: 12 },
  projectName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 9.4,
    color: COLORS.ink,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: PAGE.paddingX,
    right: PAGE.paddingX,
  },
  footerRule: { height: 0.8, backgroundColor: COLORS.ruleSoft, marginBottom: 5 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerName: { fontFamily: FONTS.mono, fontSize: 6.8, color: COLORS.muted },
  footerPage: { fontFamily: FONTS.mono, fontSize: 6.8, color: COLORS.muted },
});
