"use client";

import { useEffect, useState, useCallback, startTransition } from "react";
import { api } from "@/lib/api";

type ChannelVolume = { channel: string; count: number };
type TopService = { service: string; quotes: number; totalUsd: number };

type GrowthMetrics = {
  windowDays: number;
  since: string;
  conversationsTotal: number;
  conversationsByChannel: ChannelVolume[];
  dailyUserMessages: Array<{ day: string; count: number }>;
  messagesTotal: number;
  userMessagesTotal: number;
  quotesTotal: number;
  quotesSent: number;
  quotesAccepted: number;
  quoteConversionRate: number;
  averageQuoteUsd: number;
  topServices: TopService[];
  callRequestsTotal: number;
  llmCostUsd: number;
  llmRuns: number;
  cacheHitRate: number;
  cacheEntries: number;
  cacheHits: number;
};

type AdvisorAnswer = {
  answer: string;
  model: string;
  costUsd: number;
  spentTodayUsd: number;
  budgetUsd: number;
  budgetExceeded: boolean;
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  web_chat: "Web chat",
  telegram: "Telegram",
};

function formatUsd(value: number): string {
  return `$${value.toFixed(2)} USD`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {hint && <p className="text-xs text-zinc-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function GrowthPage() {
  const [days, setDays] = useState(30);
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null);
  const [metricsError, setMetricsError] = useState("");

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AdvisorAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");

  const loadMetrics = useCallback(async (windowDays: number) => {
    setMetricsError("");
    try {
      const res = await api.get<{ data: GrowthMetrics }>(
        `/api/dashboard/growth/metrics?days=${windowDays}`,
      );
      setMetrics(res.data);
    } catch (err) {
      setMetricsError(err instanceof Error ? err.message : "No se pudieron cargar los KPIs");
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      loadMetrics(days);
    });
  }, [days, loadMetrics]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setAskError("");
    setAnswer(null);
    try {
      const res = await api.post<{ data: AdvisorAnswer }>("/api/dashboard/growth/ask", {
        question,
      });
      setAnswer(res.data);
      setQuestion("");
    } catch (err) {
      setAskError(err instanceof Error ? err.message : "No se pudo obtener la respuesta");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold mb-1">Growth</h1>
          <p className="text-sm text-zinc-500">
            KPIs del negocio y asesor de análisis basado en los datos reales de Atiende.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-600">Ventana</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-zinc-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
        </div>
      </div>

      {metricsError && <p className="text-sm text-red-600">{metricsError}</p>}

      {metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card
              label="Conversaciones"
              value={String(metrics.conversationsTotal)}
              hint={metrics.conversationsByChannel
                .map((c) => `${CHANNEL_LABELS[c.channel] ?? c.channel}: ${c.count}`)
                .join(" · ")}
            />
            <Card label="Mensajes entrantes" value={String(metrics.userMessagesTotal)} />
            <Card label="Cotizaciones" value={String(metrics.quotesTotal)} />
            <Card
              label="Conversión de cotizaciones"
              value={formatPct(metrics.quoteConversionRate)}
              hint={`${metrics.quotesAccepted} aceptadas de ${metrics.quotesSent} enviadas`}
            />
            <Card label="Ticket promedio" value={formatUsd(metrics.averageQuoteUsd)} />
            <Card label="Leads (llamadas)" value={String(metrics.callRequestsTotal)} />
            <Card
              label="Costo LLM"
              value={formatUsd(metrics.llmCostUsd)}
              hint={`${metrics.llmRuns} ejecuciones del agente`}
            />
            <Card
              label="Hit-rate de cache"
              value={formatPct(metrics.cacheHitRate)}
              hint={`${metrics.cacheHits} hits · ${metrics.cacheEntries} entradas`}
            />
          </div>

          {metrics.topServices.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 p-6">
              <h2 className="text-sm font-semibold mb-3">Servicios más cotizados</h2>
              <ul className="space-y-2">
                {metrics.topServices.map((s) => (
                  <li
                    key={s.service}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-zinc-700">{s.service}</span>
                    <span className="text-zinc-500">
                      {s.quotes} cotizaciones · {formatUsd(s.totalUsd)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Asesor de growth</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Pregunta sobre tus datos y recibirás análisis, proyecciones y próximos pasos.
            Usa un modelo de IA independiente del agente de chat, con presupuesto diario.
          </p>
        </div>

        {askError && <p className="text-sm text-red-600">{askError}</p>}
        {answer && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-sm whitespace-pre-wrap">
            {answer.answer}
            <div className="mt-3 pt-3 border-t border-zinc-200 text-xs text-zinc-500 space-y-1">
              <p>{answer.model}</p>
              <p>
                Costo de esta pregunta: {formatUsd(answer.costUsd)} · gastado hoy:{" "}
                {formatUsd(answer.spentTodayUsd)} de {formatUsd(answer.budgetUsd)}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleAsk} className="flex flex-col gap-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ej: ¿Qué servicios generan más cotizaciones y qué debo priorizar?"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-y"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={asking || !question.trim()}
              className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {asking ? "Analizando..." : "Preguntar al asesor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
