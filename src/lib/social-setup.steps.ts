// Qué le falta al perfil para que cada coach pueda trabajar.
//
// Vive separado del componente a propósito: es lógica pura (entra el estado del perfil, sale
// una lista de pasos hechos/faltantes) y así se puede verificar con estados reales sin un
// navegador de por medio — `scripts/setup-check.ts`.
//
// Cada `done` sale de una condición del harness, no de una idea de marketing:
// nicho/audiencia → proponer audiencia; segmentos → proponer comunidades; fuentes → señales;
// señales con relevancia ≥60 → ideas; mediciones → reporte y proyección.

import type { AudienceSegment, CommunityTarget, Growth, Profile } from "./social-types";

/** Relevancia mínima para que una señal sirva para escribir una idea (la del harness). */
export const RELEVANCE_MIN_SCORE = 60;

export interface SetupStep {
  key: string;
  label: string;
  /** Para qué sirve: es lo que hace que el paso se entienda y no se sienta como un trámite. */
  why: string;
  done: boolean;
  /** A dónde ir para resolverlo. */
  href: string;
  actionLabel: string;
}

export interface SetupPhase {
  key: string;
  label: string;
  steps: SetupStep[];
}

export interface SetupInput {
  profile: Profile;
  segments: AudienceSegment[];
  targets: CommunityTarget[];
  growth: Growth | null;
  /** Señales con relevancia suficiente y sin usar: es lo que habilita generar ideas. */
  signalsReady: number;
}

export const PHASES: Array<{ key: string; label: string; steps: string[] }> = [
  { key: "base", label: "Fase 1 · La base", steps: ["perfil", "cuentas", "objetivos"] },
  { key: "gente", label: "Fase 2 · Con quién y dónde", steps: ["audiencia", "comunidades"] },
  { key: "datos", label: "Fase 3 · Los datos que la alimentan", steps: ["fuentes", "senales", "mediciones"] },
  { key: "producir", label: "Fase 4 · Producir", steps: ["ideas"] },
];

/**
 * Traduce el estado del perfil a pasos con hecho/falta.
 *
 * El orden es el de la cadena real de dependencias (nicho → audiencia → comunidades;
 * fuentes → señales → ideas; cuentas → mediciones → reporte).
 */
export function buildSteps({ profile, segments, targets, growth, signalsReady }: SetupInput): SetupStep[] {
  const activeSegments = segments.filter((segment) => segment.archivedAt === null);
  const reviewedTargets = targets.filter(
    (target) => target.status === "ACCEPTED" || target.status === "JOINED",
  );

  return [
    {
      key: "perfil",
      label: "Perfil con nombre, nicho y audiencia",
      why: "Es lo que le dice al coach a quién le hablás. Sin nicho ni audiencia no puede proponer tu audiencia ni escribir para alguien concreto.",
      done: profile.name.trim().length > 1 && (profile.niche.length > 0 || !!profile.audience),
      href: "/social/perfiles",
      actionLabel: "Completar el perfil",
    },
    {
      key: "cuentas",
      label: "Al menos una cuenta donde publicás",
      why: "Sin cuentas no hay dónde cargar métricas, y sin métricas no hay reporte ni forma de saber si crecés.",
      done: profile.accounts.length > 0,
      href: "/social/perfiles",
      actionLabel: "Agregar una cuenta",
    },
    {
      key: "objetivos",
      label: "Al menos un objetivo con plazo",
      why: "Es lo que habilita «¿vas a llegar?»: el harness compara tu ritmo real contra el objetivo, sin adivinar.",
      done: profile.objectives.length > 0,
      href: "/social/perfiles",
      actionLabel: "Definir un objetivo",
    },
    {
      key: "audiencia",
      label: "Tu audiencia, en segmentos",
      why: "Los segmentos son lo que hace que las ideas dejen de hablarle a «la gente» y le hablen a alguien. El coach de comunidad los produce.",
      done: activeSegments.length > 0,
      href: "/social/comunidad",
      actionLabel: "Proponer o escribir la audiencia",
    },
    {
      key: "comunidades",
      label: "Al menos una comunidad revisada",
      why: "Es dónde vas a participar de verdad (subreddit, grupo, hashtag). Sin revisarlas, la propuesta de la IA queda como una lista sin usar.",
      done: reviewedTargets.length > 0,
      href: "/social/comunidad",
      actionLabel: "Revisar comunidades",
    },
    {
      key: "fuentes",
      label: "Fuentes conectadas",
      why: "De las fuentes salen las señales (tendencias, noticias, videos) que después se convierten en ideas. Es lo que conecta el harness con el mundo.",
      done: profile.sources.length > 0,
      href: "/social/fuentes",
      actionLabel: "Conectar una fuente",
    },
    {
      key: "senales",
      label: `Señales analizadas con relevancia ≥${RELEVANCE_MIN_SCORE}`,
      why: "Las ideas se escriben sobre señales que ya pasaron el filtro. Sin eso, «Generar ideas» no tiene de qué hablar y te va a avisar que faltan señales.",
      done: signalsReady > 0,
      href: "/social/tendencias",
      actionLabel: "Buscar y analizar señales",
    },
    {
      key: "mediciones",
      label: "Mediciones cargadas",
      why: "Son los números de tus cuentas (seguidores, alcance). Sin al menos una medición no se arma reporte.",
      done: (growth?.measured.snapshots ?? 0) > 0,
      href: "/social/metricas",
      actionLabel: "Cargar métricas",
    },
    {
      key: "ideas",
      label: "Tu primera idea generada",
      why: "Es el producto: la idea con su gancho, su ángulo y el guion listo para publicar.",
      done: profile._count.ideas > 0,
      href: "/social/ideas",
      actionLabel: "Generar ideas",
    },
  ];
}

export interface SetupSummary {
  done: number;
  total: number;
  next: SetupStep | null;
  complete: boolean;
}

export function summarize(steps: SetupStep[]): SetupSummary {
  const done = steps.filter((step) => step.done).length;

  return {
    done,
    total: steps.length,
    next: steps.find((step) => !step.done) ?? null,
    complete: steps.length > 0 && done === steps.length,
  };
}

/** Agrupa los pasos en las 4 fases, respetando el orden de `PHASES`. */
export function toPhases(steps: SetupStep[]): SetupPhase[] {
  const byKey = new Map(steps.map((step) => [step.key, step]));

  return PHASES.map((phase) => ({
    key: phase.key,
    label: phase.label,
    steps: phase.steps
      .map((key) => byKey.get(key))
      .filter((step): step is SetupStep => step !== undefined),
  }));
}
