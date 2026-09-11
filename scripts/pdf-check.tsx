/**
 * Verificación de las plantillas PDF sin abrir un navegador.
 *
 * Renderiza la hoja de vida y la carta con datos de ejemplo usando el mismo
 * código que el dashboard, y las deja en el directorio indicado. Los PDF se
 * inspeccionan luego con poppler (pdfinfo/pdftotext/pdffonts) para comprobar
 * páginas, texto extraíble (ATS) y que TODAS las fuentes queden embebidas.
 *
 *   npm run pdf:check            # deja los PDF en la raíz
 *   npm run pdf:check -- <dir>   # o en el directorio que se indique
 *
 * El hook `pdf-loader.mjs` solo hace falta fuera de un bundler (ver el archivo).
 */
import { renderToFile } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import path from 'node:path';
import { CoverLetterDocument } from '../src/lib/pdf/CoverLetterDocument';
import { ResumeDocument } from '../src/lib/pdf/ResumeDocument';
import { registerFonts } from '../src/lib/pdf/register-fonts';
import type { CoverLetterPdfData, ResumePdfData } from '../src/lib/pdf/types';

const outDir = process.argv[2] ?? '.';
// Las fuentes viven en public/fonts; en Node hay que apuntar al disco.
registerFonts(path.join(process.cwd(), 'public'));

const profile = {
  name: 'Christian Henao',
  headline: ['AI Engineer', 'Team Leader'],
  email: 'scristxyz@gmail.com',
  phone: '+57 320 571 1428',
  location: 'Pereira, Risaralda, Colombia',
  links: [
    { type: 'github', url: 'https://github.com/Artag-Chris' },
    { type: 'website', url: 'https://www.artagdev.com.co/' },
  ],
  languages: [
    { language: 'Español', level: 'Nativo' },
    { language: 'Inglés', level: 'B2' },
  ],
};

const content = {
  headline: 'AI Engineer — Backend & Sistemas Distribuidos',
  // A propósito con caracteres "tipográficos" y un salto de línea interno: son
  // los que rompían el PDF (fuente Helvetica no embebida) o salían sin glifo.
  summary:
    'AI Engineer y Team Leader con base sólida en desarrollo backend de sistemas distribuidos, especializado en aplicaciones potenciadas por LLMs y pipelines de IA en producción.\n\n“Lidero un equipo de 4 desarrolladores” —distribución de tareas, prioridades y code reviews—. Experiencia transferible en microservicios, comunicación event-driven y despliegue en la nube: NATS, RabbitMQ, WebSockets… y más.',
  skills: [
    'TypeScript',
    'Node.js',
    'NestJS',
    'PostgreSQL + pgvector',
    'Prisma',
    'Redis / BullMQ',
    'Anthropic Claude API',
    'OpenAI Embeddings',
    'RabbitMQ',
    'Docker / Kubernetes',
    'Next.js / React',
    'Arquitectura hexagonal',
    'REST / WebSockets / Webhooks',
    'JWT / OAuth',
    'AWS (EC2)',
    'Vitest',
  ],
  experience: [
    {
      role: 'Team Leader & Full Stack Developer',
      company: 'Finova SAS',
      period: '2024 – Presente',
      bullets: [
        'Lidero un equipo de 4 desarrolladores: priorización, definición técnica y code reviews.',
        'Sistemas backend y frontend en producción para servicios financieros, con foco en seguridad e integraciones bancarias.',
      ],
    },
    {
      role: 'Software Engineer Freelance',
      company: 'Independiente',
      period: '2022 – 2024',
      bullets: [
        'Plataformas end-to-end para varios clientes: pasarelas de pago, APIs de mensajería y e-commerce.',
      ],
    },
  ],
  projects: [
    {
      name: 'Atiende — Agente conversacional de IA para WhatsApp Business',
      highlights: [
        'Arquitectura hexagonal estricta (ports & adapters) con cache multinivel: prompt caching, cache semántico en pgvector y exacto en Redis.',
        'Pipeline de agentes con tool use, presupuesto en USD por conversación y circuit breaker multi-proveedor LLM.',
        'Cache semántico + exacto proyectando ~30% de ahorro en costo LLM por conversación.',
      ],
    },
    {
      name: 'Payment Gateway Platform — integración financiera full-stack',
      highlights: [
        'Diseñé el flujo completo de pago, desde el checkout hasta la reconciliación con la API bancaria (Goupagos AvVillas).',
        'Patrón Adapter para desacoplar proveedores bancarios, reutilizado después para abstraer proveedores LLM.',
        'Webhooks de estado en tiempo real y cron jobs de reconciliación.',
      ],
    },
    {
      name: 'Microservices — plataforma de mensajería y automatización multicanal',
      highlights: [
        '12+ microservicios orquestados con RabbitMQ topic exchanges y un único gateway HTTP público.',
        'Regla estricta: los servicios nunca se comunican directo; todo write publica eventos data.* hacia un read model CQRS.',
      ],
    },
  ],
  education: [
    { institution: 'SENA', degree: 'Diseño Multimedia y Web (Tecnólogo)', period: '2023 – Presente' },
    {
      institution: 'Universidad Autónoma de Bucaramanga',
      degree: 'Programación con énfasis en aplicaciones web',
      period: '2021 – 2022',
    },
  ],
  softSkills: [
    'Liderazgo técnico: team leader de 4 desarrolladores — tareas, mentoría y code reviews.',
    'Resolución de problemas complejos y pensamiento analítico.',
    'Adaptabilidad y aprendizaje rápido de tecnologías emergentes.',
    'Comunicación efectiva con desarrolladores, diseñadores y clientes.',
  ],
};

const coverLetter = `Reciban un cordial saludo. Me dirijo a ustedes para postularme al cargo de Backend Developer en Finova SAS.

Soy Christian Henao, AI Engineer y Team Leader con base en desarrollo backend de sistemas distribuidos. Actualmente lidero un equipo de cuatro desarrolladores en Finova SAS, donde coordino la planeación, la definición técnica y los code reviews, además de construir servicios en producción para el sector financiero.

Considero que mi experiencia encaja con lo que la vacante requiere. Diseñé una pasarela de pagos de punta a punta, con webhooks de estado en tiempo real, jobs de reconciliación contra APIs bancarias y el patrón Adapter para desacoplar proveedores —el mismo patrón que luego reutilicé para abstraer proveedores de LLM. También construí una plataforma de 12+ microservicios con RabbitMQ como único mecanismo de comunicación entre servicios, lo que me dio criterio para decidir cuándo conviene un bus de eventos y cuándo no.

Además de la experiencia técnica, aporto una práctica de trabajo con IA aplicada al ciclo de desarrollo: introduje herramientas de asistencia con LLM en el flujo del equipo, acelerando iteraciones sin perder control de calidad ni revisiones humanas.

Quedo a disposición para ampliar cualquier punto de mi hoja de vida en una entrevista y agradezco de antemano el tiempo dedicado a revisar mi postulación.

Cordialmente,
Christian Henao`;

async function main() {
  const qrDataUrl = await QRCode.toDataURL('https://www.artagdev.com.co/', {
    margin: 0,
    width: 300,
  });

  const resumeData: ResumePdfData = {
    content,
    profile,
    qrDataUrl,
    qrLabel: 'www.artagdev.com.co',
  };
  const letterData: CoverLetterPdfData = {
    profile,
    coverLetter,
    company: 'Finova SAS',
    vacancyTitle: 'Backend Developer',
  };

  await renderToFile(
    <ResumeDocument data={resumeData} />,
    path.join(outDir, 'cv-sample.pdf'),
  );
  await renderToFile(
    <CoverLetterDocument data={letterData} />,
    path.join(outDir, 'cover-letter-sample.pdf'),
  );
  process.stdout.write('PDF_OK\n');
}

main().catch((err) => {
  process.stderr.write(`PDF_FAIL: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
