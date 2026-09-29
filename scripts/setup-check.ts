// Verifica el cálculo del checklist de onboarding contra estados reales del perfil.
//
//   npx tsx scripts/setup-check.ts
//
// No necesita Postgres ni navegador: `buildSteps` es puro. Los estados de abajo salen de
// llamadas reales al harness (un perfil recién creado, uno a medio armar y uno completo),
// así que si el mapa de desbloqueo se rompe, esto lo dice.

import { buildSteps, summarize, toPhases, type SetupInput } from "../src/lib/social-setup.steps";
import type { AudienceSegment, CommunityTarget, Growth, Profile } from "../src/lib/social-types";

type ProfileOverrides = Partial<Omit<Profile, "sources">> & { sources?: Profile["sources"] };

const BASE_PROFILE: Profile = {
  id: "p-1",
  name: "Mi marca",
  niche: [],
  audience: null,
  voice: null,
  language: "es",
  timezone: "America/Bogota",
  scheduleHours: null,
  autoIdeasEnabled: true,
  ideasPerWeek: 3,
  nextRunAt: null,
  accounts: [],
  objectives: [],
  sources: [],
  _count: { ideas: 0, profileSignals: 0 },
};

function profile(overrides: ProfileOverrides): Profile {
  return { ...BASE_PROFILE, ...overrides, sources: overrides.sources ?? [] };
}

function segment(name: string, archived = false): AudienceSegment {
  return {
    id: `seg-${name}`,
    profileId: "p-1",
    name,
    description: "",
    pains: [],
    desires: [],
    objections: [],
    channels: [],
    languageTips: null,
    evidence: [],
    source: "ia",
    archivedAt: archived ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
  };
}

function target(status: string): CommunityTarget {
  return {
    id: `t-${status}`,
    profileId: "p-1",
    kind: "REDDIT",
    name: "r/algo",
    url: null,
    size: null,
    activity: null,
    audienceFit: 70,
    why: "",
    segmentId: null,
    status,
    source: "ia",
    notes: null,
    verifiedAt: null,
    createdAt: new Date().toISOString(),
  };
}

function growth(snapshots: number): Growth {
  return {
    windowDays: 30,
    accounts: [],
    objectives: [],
    measured: { accounts: snapshots > 0 ? 1 : 0, snapshots },
  };
}

const scenarios: Array<{ label: string; input: SetupInput }> = [
  {
    label: "A · Perfil recién creado (solo el nombre, sin nicho)",
    input: { profile: profile({ niche: [], audience: null }), segments: [], targets: [], growth: null, signalsReady: 0 },
  },
  {
    label: "B · Lo que deja el alta guiada (nicho + 1 cuenta + 1 objetivo)",
    input: {
      profile: profile({
        niche: ["tecnologia", "ia"],
        audience: "pymes de LatAm",
        accounts: [{ id: "a-1", profileId: "p-1", platform: "INSTAGRAM", handle: "mimarca", profileUrl: null, isPrimary: true, notes: null }],
        objectives: [{ id: "o-1", metric: "POSTS_PER_WEEK", targetValue: 3, currentValue: null, dueDate: null }],
      }),
      segments: [],
      targets: [],
      growth: growth(0),
      signalsReady: 0,
    },
  },
  {
    label: "C · Perfil completo (lo que tiene el seed, más señales y mediciones)",
    input: {
      profile: profile({
        niche: ["tecnologia"],
        audience: "pymes",
        accounts: [{ id: "a-1", profileId: "p-1", platform: "LINKEDIN", handle: "mimarca", profileUrl: null, isPrimary: true, notes: null }],
        objectives: [{ id: "o-1", metric: "FOLLOWERS", targetValue: 5000, currentValue: null, dueDate: null }],
        sources: [{ id: "s-1", enabled: true, source: { id: "src-1", name: "RSS", kind: "RSS", params: {}, limits: {}, intervalHours: 24, enabled: true, lastRunAt: null, nextRunAt: null, lastStatus: null, lastError: null } }],
        _count: { ideas: 2, profileSignals: 9 },
      }),
      segments: [segment("Dueño de pyme")],
      targets: [target("ACCEPTED"), target("PROPOSED")],
      growth: growth(4),
      signalsReady: 3,
    },
  },
  {
    label: "D · Caso trampa: segmento archivado y comunidad descartada no cuentan",
    input: {
      profile: profile({ niche: ["ia"], _count: { ideas: 0, profileSignals: 0 } }),
      segments: [segment("Viejo", true)],
      targets: [target("DISCARDED")],
      growth: growth(0),
      signalsReady: 0,
    },
  },
];

let failures = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    console.log(`  ✗ ${message}`);
    failures += 1;
  }
}

for (const scenario of scenarios) {
  const steps = buildSteps(scenario.input);
  const { done, total, next, complete } = summarize(steps);
  console.log(`\n${scenario.label}`);
  console.log(`  ${done}/${total} hechos · siguiente: ${next ? next.key : "ninguno"}${complete ? " (completo)" : ""}`);
  console.log(
    `  fases: ${toPhases(steps)
      .map((phase) => `${phase.key} ${phase.steps.filter((step) => step.done).length}/${phase.steps.length}`)
      .join(" · ")}`,
  );

  if (scenario.label.startsWith("A")) {
    check(!steps.find((step) => step.key === "perfil")?.done, "sin nicho ni audiencia, el paso del perfil NO está hecho");
    check(next?.key === "perfil", "el siguiente paso es completar el perfil");
  }
  if (scenario.label.startsWith("B")) {
    check(done === 3, "quedan 3 hechos (perfil, cuenta, objetivo)");
    check(next?.key === "audiencia", "el siguiente es la audiencia (no las fuentes)");
    check(steps.find((step) => step.key === "ideas")?.done === false, "sin señales, no hay ideas");
  }
  if (scenario.label.startsWith("C")) {
    check(complete, "un perfil completo queda 9/9: no hay falsos pendientes");
  }
  if (scenario.label.startsWith("D")) {
    check(!steps.find((step) => step.key === "audiencia")?.done, "un segmento archivado no cuenta como audiencia");
    check(!steps.find((step) => step.key === "comunidades")?.done, "una comunidad descartada no cuenta como revisada");
  }
}

console.log(failures === 0 ? "\nTodo bien: el mapa de desbloqueo coincide con lo que pide el harness." : `\n${failures} chequeo(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
