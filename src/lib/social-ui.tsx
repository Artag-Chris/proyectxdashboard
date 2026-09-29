"use client";

// Kit chico de UI para la pestaña Social Coach. Mismo estilo que el resto del
// dashboard (rounded-xl + zinc + emerald) en vez de traer una librería nueva.
import Link from "next/link";
import { useEffect, useState } from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline gap-2">
      <h2 className="text-sm font-semibold text-emerald-700">{children}</h2>
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </div>
  );
}

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
};

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  title,
  type = "button",
  className = "",
}: ButtonProps) {
  const styles: Record<string, string> = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-700",
    secondary: "border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
    ghost: "text-zinc-600 hover:bg-zinc-100",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-400">{hint}</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Badge({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "emerald" | "amber" | "red" | "blue" | "violet";
}) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-100 text-zinc-600",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${tones[tone]}`}>{children}</span>
  );
}

/** Relevancia 0-100, con el color que corresponde al veredicto. */
export function Score({ score }: { score: number }) {
  const tone = score >= 70 ? "emerald" : score >= 40 ? "amber" : "zinc";
  return (
    <Badge tone={score === 0 ? "zinc" : tone}>{score === 0 ? "sin analizar" : `${score}/100`}</Badge>
  );
}

export const IDEA_STATUS_LABEL: Record<string, string> = {
  IDEA: "Idea",
  APPROVED: "Aprobada",
  SCHEDULED: "Programada",
  PUBLISHED: "Publicada",
  DISCARDED: "Descartada",
};

export const IDEA_STATUS_TONE: Record<string, "zinc" | "emerald" | "amber" | "red" | "blue" | "violet"> = {
  IDEA: "zinc",
  APPROVED: "blue",
  SCHEDULED: "violet",
  PUBLISHED: "emerald",
  DISCARDED: "red",
};

export const SIGNAL_KIND_LABEL: Record<string, string> = {
  TREND: "Tendencia",
  NEWS: "Noticia",
  VIDEO: "Video",
  POST: "Post",
  ARTICLE: "Artículo",
  INSPIRATION: "Inspiración",
  OTHER: "Otro",
};

/** Objetivos medibles (los mismos valores que `ObjectiveMetric` en el harness). */
export const OBJECTIVE_METRIC_LABEL: Record<string, string> = {
  FOLLOWERS: "Seguidores",
  ENGAGEMENT_RATE: "Engagement",
  REACH: "Alcance",
  POSTS_PER_WEEK: "Publicaciones por semana",
  LEADS: "Leads",
};

/**
 * Veredicto del gap de objetivos. Lo calcula el harness (`metrics/growth.ts`) y acá solo se
 * traduce: el dashboard no estima ritmos por su cuenta.
 */
export const OBJECTIVE_VERDICT_LABEL: Record<string, string> = {
  ACHIEVED: "Cumplido",
  ON_TRACK: "Vas bien",
  BEHIND: "Atrasado",
  NO_PACE: "Faltan mediciones",
  NO_CURRENT: "Falta el dato",
};

export const OBJECTIVE_VERDICT_TONE: Record<string, "zinc" | "emerald" | "amber" | "red" | "blue" | "violet"> = {
  ACHIEVED: "emerald",
  ON_TRACK: "emerald",
  BEHIND: "red",
  NO_PACE: "amber",
  NO_CURRENT: "zinc",
};

/** Tipos de comunidad (las claves del catálogo del harness). */
export const COMMUNITY_KIND_LABEL: Record<string, string> = {
  REDDIT: "Subreddit",
  FACEBOOK_GROUP: "Grupo de Facebook",
  DISCORD: "Discord",
  TELEGRAM: "Telegram",
  FORO: "Foro",
  HASHTAG: "Hashtag",
  CANAL: "Canal o creador",
  NEWSLETTER: "Newsletter",
  OTRO: "Otro",
};

/** Estado de una comunidad: qué decidió el humano (no de dónde salió). */
export const COMMUNITY_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "Sin revisar",
  ACCEPTED: "Aceptada",
  DISCARDED: "Descartada",
  JOINED: "Ya estoy",
};

export const COMMUNITY_STATUS_TONE: Record<string, "zinc" | "emerald" | "amber" | "red" | "blue" | "violet"> = {
  PROPOSED: "amber",
  ACCEPTED: "blue",
  DISCARDED: "zinc",
  JOINED: "emerald",
};

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-zinc-400">{children}</p>;
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="my-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export function Loading({ what = "Cargando…" }: { what?: string }) {
  return <p className="py-6 text-center text-sm text-zinc-400">{what}</p>;
}

export function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relative(value?: string | null): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "—";
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `hace ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/** El número más alto de `metrics` (cada fuente trae lo que puede). */
export function topMetric(metrics: Record<string, unknown> | null | undefined): number {
  if (!metrics) return 0;
  const values = Object.values(metrics).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return values.length > 0 ? Math.max(...values) : 0;
}

export function compact(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}M`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10}K`;
  return String(value);
}

/**
 * Perfil activo de la pestaña, recordado en el navegador.
 *
 * Hay varios perfiles desde el día uno, así que toda la pestaña mira UNO y se cambia
 * desde el resumen: el resto de las vistas lo recibe por query string, así que el
 * enlace es compartible y no hay estado global escondido.
 */
export function useActiveProfile(profiles: { id: string; name: string }[] | null) {
  const [profileId, setProfileId] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("social_profile") ?? "";
    if (saved) setProfileId(saved);
  }, []);

  const list = profiles ?? [];
  const effective = profileId && list.some((p) => p.id === profileId) ? profileId : (list[0]?.id ?? "");

  const select = (id: string) => {
    setProfileId(id);
    if (typeof window !== "undefined") window.localStorage.setItem("social_profile", id);
  };

  return { profileId: effective, select, ready: list.length > 0 };
}

/**
 * Selector del perfil activo (toda la pestaña mira uno).
 *
 * Con un solo perfil no hay nada que elegir, pero igual se muestra cuál está activo: sin
 * esto, quien recién entra no sabe sobre qué perfil está trabajando. Con ninguno, el
 * componente es el único lugar que avisa que falta crearlo (aparece en todas las pestañas).
 */
export function ProfilePicker({
  profiles,
  value,
  onChange,
}: {
  profiles: Array<{ id: string; name: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  if (profiles.length === 0) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Perfil:</span>
        <Link
          href="/social/empezar"
          className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-100"
        >
          Todavía no hay ninguno · crear el primero
        </Link>
      </div>
    );
  }

  if (profiles.length === 1) {
    return (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Perfil:</span>
        <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm text-white">
          {profiles[0]?.name}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-zinc-500">Perfil:</span>
      {profiles.map((profile) => (
        <button
          key={profile.id}
          onClick={() => onChange(profile.id)}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            profile.id === value
              ? "bg-emerald-600 text-white"
              : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
          }`}
        >
          {profile.name}
        </button>
      ))}
    </div>
  );
}
