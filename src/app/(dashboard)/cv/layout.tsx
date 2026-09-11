"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCvSession } from "@/lib/cv-api";

const TABS = [
  { href: "/cv", label: "Resumen" },
  { href: "/cv/vacantes", label: "Vacantes" },
  { href: "/cv/pegar", label: "Pegar oferta" },
  { href: "/cv/perfiles", label: "Perfiles & CV" },
  { href: "/cv/fuentes", label: "Fuentes" },
  { href: "/cv/notificaciones", label: "Notificaciones" },
];

/**
 * Pestaña CV Harness. Sin segundo login: usa la sesión de atiende
 * (mismo JWT que valida el harness en el server).
 */
export default function CvLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setEmail(getCvSession().email);
    setChecked(true);
  }, []);

  if (!checked) {
    return <div className="p-10 text-center text-zinc-400">Cargando…</div>;
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
                  active ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>{email ? `Sesión: ${email}` : "Sesión de atiende"}</span>
          <button
            onClick={() => {
              localStorage.removeItem("atiende_auth");
              router.replace("/login");
            }}
            className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
