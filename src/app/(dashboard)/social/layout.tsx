"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSocialSession } from "@/lib/social-api";

const TABS = [
  { href: "/social", label: "Resumen" },
  { href: "/social/tendencias", label: "Tendencias" },
  { href: "/social/ideas", label: "Ideas y calendario" },
  { href: "/social/inspiracion", label: "Pegar inspiración" },
  { href: "/social/perfiles", label: "Perfiles" },
  { href: "/social/fuentes", label: "Fuentes" },
  { href: "/social/metricas", label: "Métricas y reportes" },
  { href: "/social/notificaciones", label: "Avisos" },
];

/**
 * Pestaña Social Coach. Sin segundo login: usa la sesión de atiende (el mismo JWT
 * que valida el harness en el server).
 */
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setEmail(getSocialSession().email);
    setChecked(true);
  }, []);

  if (!checked) {
    return <div className="p-10 text-center text-zinc-400">Cargando…</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2">
        <div className="flex flex-nowrap gap-1 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          {TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-emerald-600 text-white" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="max-w-[60vw] truncate">
            {email ? `Sesión: ${email}` : "Sesión de atiende"}
          </span>
          <button
            onClick={() => {
              localStorage.removeItem("atiende_auth");
              router.replace("/login");
            }}
            className="rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
