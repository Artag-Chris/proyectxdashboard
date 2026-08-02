"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { displayName, type PendingItem, type PendingResponse } from "@/components/PendingMonitor";
import { channelBadge } from "@/lib/channel";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function statusLabel(status: string): string {
  switch (status) {
    case "ESCALATED":
      return "Escalada";
    case "RESOLVED":
      return "Resuelta";
    case "ABANDONED":
      return "Abandonada";
    default:
      return "Activa";
  }
}

export default function PendientesPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPending = useCallback(async () => {
    try {
      setError("");
      const res = await api.get<PendingResponse>("/api/dashboard/pending");
      setItems(res.data ?? []);
    } catch {
      setError("Error al cargar pendientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    function startPolling() {
      interval = setInterval(() => {
        startTransition(() => { fetchPending(); });
      }, 10000);
    }

    function stopPolling() {
      clearInterval(interval);
    }

    startTransition(() => { fetchPending(); });
    startPolling();

    const handleVisibility = () => {
      stopPolling();
      if (!document.hidden) {
        startPolling();
        startTransition(() => { fetchPending(); });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchPending]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500">Cargando pendientes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchPending}
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
      <h1 className="text-xl font-bold mb-6">Pendientes</h1>

      {items.length === 0 ? (
        <p className="text-zinc-500 text-center py-12">No hay conversaciones pendientes</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/conversations/${item.id}`}
              className="block bg-white rounded-xl shadow-sm border border-zinc-200 p-4 hover:border-zinc-400 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-zinc-900 truncate">
                      {displayName(item)}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${channelBadge(item.channel).className}`}
                    >
                      {channelBadge(item.channel).label}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 shrink-0">
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  {item.lastMessageText && (
                    <p className="text-sm text-zinc-600 mt-1 line-clamp-2">
                      {item.lastMessageText}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className="text-xs text-zinc-400">{formatDate(item.lastMessageAt)}</span>
                  {item.unreadCount > 0 && (
                    <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium">
                      {item.unreadCount > 99 ? "99+" : item.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
