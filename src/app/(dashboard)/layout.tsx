"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

const navItems = [
  { href: "/escalations", label: "Escalaciones" },
  { href: "/knowledge", label: "Conocimiento" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-zinc-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <aside className="w-56 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-4 border-b border-zinc-200">
          <h2 className="font-semibold text-sm">Atiende Dashboard</h2>
          <p className="text-xs text-zinc-500 mt-1">{user.email}</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-zinc-200 space-y-1">
          <span className="block px-3 py-2 text-xs text-zinc-400">{user.role}</span>
          <button
            onClick={logout}
            className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Cerrar sesi&oacute;n
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
