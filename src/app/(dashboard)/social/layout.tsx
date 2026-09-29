"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSocialSession, socialApi } from "@/lib/social-api";
import { usePoll } from "@/lib/usePoll";

const TABS = [
  { href: "/social", label: "Resumen" },
  { href: "/social/tendencias", label: "Tendencias" },
  { href: "/social/ideas", label: "Ideas y calendario" },
  { href: "/social/comunidad", label: "Comunidad" },
  { href: "/social/inspiracion", label: "Pegar inspiración" },
  { href: "/social/perfiles", label: "Perfiles" },
  { href: "/social/fuentes", label: "Fuentes" },
  { href: "/social/metricas", label: "Métricas y reportes" },
  { href: "/social/notificaciones", label: "Avisos" },
];

const SETUP_PATH = "/social/empezar";

/**
 * Pestaña Social Coach. Sin segundo login: usa la sesión de atiende (el mismo JWT
 * que valida el harness en el server).
 *
 * Sin ningún perfil, la pestaña no tiene sentido: todo cuelga de un perfil, así que
 * se lleva al alta guiada y se esconden las pestañas (vuelven al crear el perfil). No se
 * esconde nada para siempre: es el único caso donde no hay nada que mostrar.
 */
export default function SocialLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [checked, setChecked] = useState(false);
  const { data: profiles, reload: reloadProfiles } = usePoll<Array<{ id: string }>>(
    () => socialApi.get("/profiles"),
    30000,
  );

  const onboarding = pathname === SETUP_PATH || pathname.startsWith(`${SETUP_PATH}/`);
  // Solo con la lista confirmada: un error de red no puede mandar a nadie al alta.
  const noProfiles = profiles !== null && profiles.length === 0;

  useEffect(() => {
    setEmail(getSocialSession().email);
    setChecked(true);
  }, []);

  useEffect(() => {
    if (noProfiles && !onboarding) router.replace(SETUP_PATH);
  }, [noProfiles, onboarding, router]);

  // El alta avisa cuando crea el perfil: sin esto habría que esperar el próximo sondeo.
  useEffect(() => {
    const onChange = () => reloadProfiles();
    window.addEventListener("social:profiles-changed", onChange);
    return () => window.removeEventListener("social:profiles-changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) {
    return <div className="p-10 text-center text-zinc-400">Cargando…</div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2">
        {onboarding ? (
          <span className="py-2 text-sm text-zinc-500">Creando tu primer perfil</span>
        ) : (
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
        )}
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
      {noProfiles && !onboarding ? (
        <div className="p-10 text-center text-sm text-zinc-400">
          Todavía no hay ningún perfil: te llevo al alta guiada…
        </div>
      ) : (
        children
      )}
    </div>
  );
}
