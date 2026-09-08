"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { cvApi, cvLogin, clearCvSession, getCvSession } from "@/lib/cv-api";

const TABS = [
  { href: "/cv", label: "Resumen" },
  { href: "/cv/vacantes", label: "Vacantes" },
  { href: "/cv/perfiles", label: "Perfiles & CV" },
  { href: "/cv/fuentes", label: "Fuentes" },
  { href: "/cv/notificaciones", label: "Notificaciones" },
];

function CvLogin() {
  const [email, setEmail] = useState("admin@cvharness.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await cvLogin(email, password);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-xl font-bold text-center">CV Harness</h1>
      <p className="mt-1 text-center text-sm text-zinc-500">
        Vacantes &rarr; match vectorial + IA &rarr; hoja de vida
      </p>
      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="cv-email" className="block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="cv-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        <div>
          <label htmlFor="cv-password" className="block text-sm font-medium text-zinc-700">
            Contraseña
          </label>
          <input
            id="cv-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Ingresando…" : "Conectar con CV Harness"}
        </button>
        <p className="text-xs text-zinc-400">
          Sesión independiente del dashboard de atiende (JWT propio del harness).
        </p>
      </form>
    </div>
  );
}

export default function CvLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const s = getCvSession();
    setSession(s);
    setChecked(true);
  }, []);

  if (!checked) {
    return <div className="p-10 text-center text-zinc-400">Cargando…</div>;
  }

  if (!session) {
    return (
      <div>
        <div className="mb-4 flex gap-1 border-b border-zinc-200">
          {TABS.map((t) => (
            <span key={t.href} className="px-3 py-2 text-sm text-zinc-400">
              {t.label}
            </span>
          ))}
        </div>
        <CvLogin />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <button
          onClick={() => {
            clearCvSession();
            setSession(null);
          }}
          className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          Salir de CV ({session.email})
        </button>
      </div>
      {children}
    </div>
  );
}
