"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.push("/escalations");
  }, [user, router]);

  if (user) return null;

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Atiende Dashboard</h1>
        <p className="text-zinc-500">Panel de administraci&oacute;n</p>
        <Link
          href="/login"
          className="inline-block mt-4 px-6 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
        >
          Iniciar sesi&oacute;n
        </Link>
      </div>
    </div>
  );
}
