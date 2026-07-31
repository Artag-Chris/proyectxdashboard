"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") ?? "") as string;
    const password = (form.get("password") ?? "") as string;

    try {
      await login(email, password);
      router.push("/escalations");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError("Credenciales inv\u00e1lidas");
        else if (err.status === 429)
          setError("Demasiados intentos. Intente de nuevo m\u00e1s tarde.");
        else setError("Error de conexi\u00f3n con el servidor");
      } else {
        setError("Error de conexi\u00f3n con el servidor");
      }
    }
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm mx-4">
        <h1 className="text-2xl font-bold text-center mb-8">Atiende Dashboard</h1>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-white p-6 rounded-xl shadow-sm border border-zinc-200"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
              Contrase&ntilde;a
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? "Ingresando..." : "Iniciar sesi\u00f3n"}
          </button>
        </form>
      </div>
    </div>
  );
}
