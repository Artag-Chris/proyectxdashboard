"use client";

// Onboarding del harness: qué le falta al perfil y cómo desbloquear cada coach.
//
// La regla es "guía en el lugar": ninguna pestaña se esconde. Cada una se puede abrir y, si
// todavía no puede dar nada, dice qué dato la desbloquea y lleva hasta ahí. Este archivo
// junta las dos piezas de eso: el checklist de primeros pasos (Resumen) y la tarjeta de
// bloqueo que usan las pestañas. El cálculo de los pasos vive en `social-setup.steps.ts`
// (lógica pura, verificable con `scripts/setup-check.ts`).
//
// Todo sale de endpoints que ya existen: no hay API nueva ni migración. El único trabajo es
// leerlos y traducirlos a "hecho / falta".

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AudienceSegment, CommunityTarget, Growth, Profile, SignalListResponse } from "./social-types";
import { socialApi } from "./social-api";
import { Button, Card, Loading, SectionTitle } from "./social-ui";
import { usePoll } from "./usePoll";
import {
  RELEVANCE_MIN_SCORE,
  buildSteps,
  summarize,
  toPhases,
  type SetupPhase,
  type SetupStep,
} from "./social-setup.steps";

interface Bundle {
  profile: Profile;
  segments: AudienceSegment[];
  targets: CommunityTarget[];
  growth: Growth | null;
  signalsReady: number;
}

export interface SetupState {
  phases: SetupPhase[];
  steps: SetupStep[];
  done: number;
  total: number;
  /** El primer paso pendiente: es el que la UI destaca. */
  next: SetupStep | null;
  complete: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Estado del perfil traducido a "qué falta".
 *
 * Los cuatro endpoints secundarios toleran error (si uno falla, su paso queda pendiente en
 * vez de tumbar todo el checklist); el del perfil sí propaga, porque sin perfil no hay nada
 * que evaluar y la página ya sabe mostrar ese error.
 */
export function useSetup(profileId: string): SetupState {
  const poll = usePoll<Bundle | null>(
    async () => {
      if (!profileId) return null;

      const profile = await socialApi.get<Profile>(`/profiles/${profileId}`);
      const [segments, targets, growth, signals] = await Promise.all([
        socialApi.get<AudienceSegment[]>(`/profiles/${profileId}/audience`).catch(() => []),
        socialApi.get<CommunityTarget[]>(`/profiles/${profileId}/communities`).catch(() => []),
        socialApi.get<Growth>(`/profiles/${profileId}/growth?days=30`).catch(() => null),
        socialApi
          .get<SignalListResponse>(
            `/signals?profileId=${profileId}&minRelevance=${RELEVANCE_MIN_SCORE}&limit=1`,
          )
          .catch(() => null),
      ]);

      return { profile, segments, targets, growth, signalsReady: signals?.total ?? 0 };
    },
    60000,
    [profileId],
  );

  const steps = poll.data ? buildSteps(poll.data) : [];
  const { done, total, next, complete } = summarize(steps);

  return {
    phases: toPhases(steps),
    steps,
    done,
    total,
    next,
    complete,
    loading: !!profileId && !poll.data && !poll.error,
    error: poll.error,
    reload: poll.reload,
  };
}

/** Botón que navega: un `<button>` adentro de un `<a>` es HTML inválido, así que va por router. */
export function GoButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  return (
    <Button variant={variant} onClick={() => router.push(href)}>
      {children}
    </Button>
  );
}

/**
 * Tarjeta de bloqueo de una pestaña: dice qué falta, para qué sirve y a dónde ir.
 *
 * Reemplaza al "no hay nada" mudo: el usuario nunca tiene que adivinar por qué una pantalla
 * está vacía.
 */
export function LockedCard({
  title,
  requirement,
  href,
  actionLabel,
}: {
  title: string;
  /** Qué falta, en concreto y en el idioma del usuario. */
  requirement: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Card className="mt-4">
      <SectionTitle hint="se destraba solo cuando el perfil tenga lo que pide">{title}</SectionTitle>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-sm text-amber-800">{requirement}</p>
      </div>
      <div className="mt-3">
        <GoButton href={href}>{actionLabel}</GoButton>
      </div>
    </Card>
  );
}

/**
 * Checklist de primeros pasos (va en Resumen).
 *
 * Cuando está todo hecho se muestra en una línea: el objetivo es que deje de ocupar espacio
 * en cuanto el harness ya puede trabajar.
 */
export function SetupChecklist({ profileId }: { profileId: string }) {
  const { phases, done, total, next, complete, loading, error } = useSetup(profileId);

  if (!profileId || error) return null;

  if (loading) {
    return (
      <Card className="mt-4">
        <Loading what="Revisando qué le falta al perfil…" />
      </Card>
    );
  }

  if (complete) {
    return (
      <Card className="mt-4">
        <SectionTitle hint={`${total} de ${total}`}>Primeros pasos</SectionTitle>
        <p className="text-sm text-emerald-700">
          Listo: el perfil tiene todo lo que los coaches necesitan. De acá en adelante es constancia.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <SectionTitle hint={`${done} de ${total} hechos`}>
        Primeros pasos: qué falta para que el harness te sirva
      </SectionTitle>

      {next && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-sm font-medium text-emerald-800">Seguí por acá: {next.label}</p>
          <p className="mt-1 text-xs text-emerald-700">{next.why}</p>
          <div className="mt-2">
            <GoButton href={next.href}>{next.actionLabel}</GoButton>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {phases.map((phase) => {
          const phaseDone = phase.steps.filter((step) => step.done).length;
          const phaseComplete = phaseDone === phase.steps.length;
          return (
            <div key={phase.key}>
              <p className="mb-1 text-xs font-medium text-zinc-500">
                {phase.label} · {phaseDone}/{phase.steps.length}
                {phaseComplete ? " ✓" : ""}
              </p>
              <ul className="space-y-1">
                {phase.steps.map((step) => (
                  <li key={step.key} className="flex items-start gap-2 text-sm">
                    <span className={step.done ? "text-emerald-600" : "text-zinc-300"}>
                      {step.done ? "✓" : "○"}
                    </span>
                    <Link
                      href={step.href}
                      title={step.why}
                      className={
                        step.done
                          ? "text-zinc-400 line-through"
                          : "text-zinc-700 underline decoration-dotted underline-offset-2 hover:text-emerald-700"
                      }
                    >
                      {step.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
