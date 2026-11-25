"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface SenderOption {
  domain: string;
  defaultFrom: string;
  displayName?: string;
  isDefault: boolean;
}

const FALLBACK_SENDERS: SenderOption[] = [
  {
    domain: "artagdev.com.co",
    defaultFrom: "Artag <info@artagdev.com.co>",
    displayName: "Artag",
    isDefault: true,
  },
  {
    domain: "lumenxlabs.com.co",
    defaultFrom: "Lumen X <info@lumenxlabs.com.co>",
    displayName: "Lumen X",
    isDefault: false,
  },
];

export default function EmailsPage() {
  const [senders, setSenders] = useState<SenderOption[]>(FALLBACK_SENDERS);
  const [fromDomain, setFromDomain] = useState<string>("artagdev.com.co");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get<{ senders: SenderOption[] }>("/api/dashboard/emails/senders")
      .then((res) => {
        if (!active || !Array.isArray(res?.senders) || res.senders.length === 0) return;
        setSenders(res.senders);
        const def = res.senders.find((s) => s.isDefault) ?? res.senders[0];
        if (def) setFromDomain(def.domain);
      })
      .catch(() => {
        // Si el backend aún no expone /emails/senders, mantenemos las opciones por defecto.
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    setSuccess("");

    try {
      const res = await api.post<{ ok: boolean; to: string; from?: string }>(
        "/api/dashboard/emails/send",
        {
          fromDomain,
          to,
          subject,
          text,
        },
      );
      const selected = senders.find((s) => s.domain === fromDomain);
      const senderLabel = res.from ?? selected?.defaultFrom ?? fromDomain;
      setSuccess(`Email enviado a ${res.to} desde ${senderLabel}`);
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
    <div className="max-w-2xl sm:mx-auto">
      <h1 className="text-lg font-bold mb-1 sm:text-xl">Enviar email</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Envía correos corporativos firmados con tu propio dominio. El destinatario verá la
        dirección seleccionada y sus respuestas llegarán automáticamente a tu bandeja principal.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {success && <p className="text-sm text-emerald-600 mb-4">{success}</p>}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white rounded-xl shadow-sm border border-zinc-200 p-6"
      >
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Desde (remitente)</label>
          <select
            value={fromDomain}
            onChange={(e) => setFromDomain(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 sm:text-sm"
          >
            {senders.map((sender) => (
              <option key={sender.domain} value={sender.domain}>
                {sender.defaultFrom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Para</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="cliente@mail.com"
            required
            maxLength={200}
            className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 sm:text-sm"
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
            className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 sm:text-sm"
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
            className="w-full px-3 py-2.5 rounded-lg border border-zinc-300 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-y sm:text-sm"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={sending || !to || !subject || !text}
            className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-700 disabled:opacity-50 transition-colors sm:w-auto"
          >
            {sending ? "Enviando..." : "Enviar email"}
          </button>
        </div>
      </form>
    </div>
  );
}
