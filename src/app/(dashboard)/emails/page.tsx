"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function EmailsPage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post<{ ok: boolean; to: string }>("/api/dashboard/emails/send", {
        to,
        subject,
        text,
      });
      setSuccess(`Email enviado a ${res.to}`);
      setTo("");
      setSubject("");
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el email");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Enviar email</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Solo los usuarios autenticados (ADMIN/SUPER_ADMIN) pueden enviar emails desde
        este panel. El agente de chat nunca envía emails por su cuenta.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {success && <p className="text-sm text-emerald-600 mb-4">{success}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Para</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="cliente@mail.com"
            required
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Asunto</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Asunto del email"
            required
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Mensaje</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            required
            maxLength={10000}
            placeholder="Escribe el contenido del email..."
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-y"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !to || !subject || !text}
            className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {sending ? "Enviando..." : "Enviar email"}
          </button>
        </div>
      </form>
    </div>
  );
}
