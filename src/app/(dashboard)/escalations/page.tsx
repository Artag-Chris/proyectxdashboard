"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type ApiEscalation = {
  id: string;
  customerIdentifier: string;
  status: string;
  escalationReason: string | null;
  escalatedAt: string | null;
  urgency: string;
  createdAt: string;
};

type ApiResponse = {
  data: ApiEscalation[];
  total: number;
};

type Escalation = {
  id: string;
  conversationId: string;
  reason: string;
  urgency: string;
  customerPhone: string;
  createdAt: string;
  conversation: {
    customerIdentifier: string;
    status: string;
  };
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchEscalations = useCallback(async () => {
    try {
      setError("");
      const res = await api.get<ApiResponse>("/api/dashboard/escalations");
      setEscalations(
        res.data.map((e) => ({
          id: e.id,
          conversationId: e.id,
          reason: e.escalationReason ?? "",
          urgency: e.urgency.toLowerCase(),
          customerPhone: e.customerIdentifier,
          createdAt: e.createdAt,
          conversation: {
            customerIdentifier: e.customerIdentifier,
            status: e.status,
          },
        })),
      );
    } catch {
      setError("Error al cargar escalaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    function startPolling() {
      interval = setInterval(() => {
        startTransition(() => { fetchEscalations(); });
      }, 10000);
    }

    function stopPolling() {
      clearInterval(interval);
    }

    startTransition(() => { fetchEscalations(); });
    startPolling();

    const handleVisibility = () => {
      stopPolling();
      if (!document.hidden) {
        startPolling();
        startTransition(() => { fetchEscalations(); });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchEscalations]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500">Cargando escalaciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchEscalations}
            className="text-sm text-zinc-600 underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Escalaciones</h1>

      {escalations.length === 0 ? (
        <p className="text-zinc-500 text-center py-12">
          No hay escalaciones pendientes
        </p>
      ) : (
        <div className="space-y-3">
          {escalations.map((esc) => (
            <Link
              key={esc.id}
              href={`/conversations/${esc.conversationId}`}
              className="block bg-white rounded-xl shadow-sm border border-zinc-200 p-4 hover:border-zinc-400 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm text-zinc-900">
                    {esc.conversation?.customerIdentifier ?? esc.customerPhone}
                  </p>
                  <p className="text-sm text-zinc-600 mt-1 line-clamp-2">
                    {esc.reason}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      esc.urgency === "high"
                        ? "bg-red-100 text-red-700"
                        : esc.urgency === "medium"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {esc.urgency}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {formatDate(esc.createdAt)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
