"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import PendingMonitor from "@/components/PendingMonitor";
import { isNotificationSupported, requestNotificationPermission } from "@/lib/notifications";

const navItems = [
  { href: "/pendientes", label: "Pendientes" },
  { href: "/escalations", label: "Escalaciones" },
  { href: "/emails", label: "Email" },
  { href: "/knowledge", label: "Conocimiento" },
  { href: "/growth", label: "Growth" },
  { href: "/cv", label: "CV Harness" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingTotal, setPendingTotal] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [notifState, setNotifState] = useState<NotificationPermission | "unsupported">(
    isNotificationSupported() ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  const handleEnableNotifications = async () => {
    const permission = await requestNotificationPermission();
    setNotifState(permission);
  };

  if (isLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">Cargando...</p>
      </div>
    );
  }

  const activeLabel =
    navItems.find((item) => pathname.startsWith(item.href))?.label ?? "Atiende";

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <PendingMonitor onTotalChange={setPendingTotal} />

      {/* Barra superior: solo mobile */}
      <header className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-2 pt-safe md:hidden">
        <div className="flex h-14 w-full items-center gap-1">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={navOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
          >
            <span className="flex h-4 w-5 flex-col justify-between">
              <span className="h-0.5 w-full rounded bg-current" />
              <span className="h-0.5 w-full rounded bg-current" />
              <span className="h-0.5 w-full rounded bg-current" />
            </span>
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {activeLabel}
          </p>
          <Link
            href="/pendientes"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
          >
            <span>Pend.</span>
            {pendingTotal > 0 && (
              <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium">
                {pendingTotal > 99 ? "99+" : pendingTotal}
              </span>
            )}
          </Link>
          {notifState === "granted" ? (
            <span className="flex h-10 shrink-0 items-center px-2 text-xs text-emerald-600">
              Alertas on
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={notifState === "unsupported"}
              className="flex h-10 shrink-0 items-center rounded-lg px-2 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
            >
              {notifState === "unsupported" ? "Sin alertas" : "Activar alertas"}
            </button>
          )}
        </div>
      </header>

      {/* Backdrop del drawer: solo mobile */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar en desktop, drawer en mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-zinc-200 bg-white transition-transform duration-200 md:static md:z-auto md:w-56 md:max-w-none md:translate-x-0 md:transition-none ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-zinc-200">
          <h2 className="font-semibold text-sm">Atiende Dashboard</h2>
          <p className="text-xs text-zinc-500 mt-1 truncate">{user.email}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setNavOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              <span>{item.label}</span>
              {item.href === "/pendientes" && pendingTotal > 0 && (
                <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium">
                  {pendingTotal > 99 ? "99+" : pendingTotal}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-zinc-200 p-2 pb-safe md:pb-2">
          {notifState === "granted" ? (
            <span className="block px-3 py-1 text-xs text-emerald-600">
              Notificaciones activadas
            </span>
          ) : (
            <button
              onClick={handleEnableNotifications}
              disabled={notifState === "unsupported"}
              className="block w-full text-left px-3 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
            >
              {notifState === "unsupported"
                ? "Notificaciones no soportadas"
                : "Activar notificaciones"}
            </button>
          )}
          <span className="block px-3 py-2 text-xs text-zinc-400">{user.role}</span>
          <button
            onClick={logout}
            className="block w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Cerrar sesi&oacute;n
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 pb-8 md:p-6">
        {children}
      </main>
    </div>
  );
}
