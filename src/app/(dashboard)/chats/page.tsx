"use client";

import { useState, useEffect, startTransition } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { displayName } from "@/components/PendingMonitor";
import { channelBadge } from "@/lib/channel";
import {
  CONVERSATION_STATUSES,
  formatDateTime,
  statusBadgeClass,
  statusLabel,
  type ConversationListResponse,
} from "@/lib/conversation";

const PAGE_SIZE = 25;

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "messenger", label: "Messenger" },
  { value: "web_chat", label: "Web Chat" },
  { value: "telegram", label: "Telegram" },
];

const selectClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400";

export default function ChatsPage() {
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const [items, setItems] = useState<ConversationListResponse["data"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (channel) params.set("channel", channel);
    if (debouncedQuery) params.set("q", debouncedQuery);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));

    const load = async () => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);

      try {
        setError("");
        const res = await api.get<ConversationListResponse>(
          `/api/dashboard/conversations?${params.toString()}`,
        );
        if (cancelled) return;
        const page = res.data ?? [];
        startTransition(() => {
          setItems((prev) => (offset === 0 ? page : [...prev, ...page]));
          setTotal(res.total ?? 0);
        });
      } catch {
        if (!cancelled) setError("Error al cargar los chats");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [status, channel, debouncedQuery, offset, reloadKey]);

  const handleRefresh = () => {
    setOffset(0);
    setReloadKey((key) => key + 1);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
        <h1 className="text-lg font-bold sm:text-xl">Chats</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || loadingMore}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
        >
          Actualizar
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o identificador..."
          className={`${selectClass} w-full sm:max-w-xs`}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
          className={`${selectClass} w-full sm:w-auto`}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {CONVERSATION_STATUSES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            setOffset(0);
          }}
          className={`${selectClass} w-full sm:w-auto`}
          aria-label="Filtrar por canal"
        >
          <option value="">Todos los canales</option>
          {CHANNEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-zinc-500">Cargando chats...</p>
        </div>
      ) : error ? (
        <div className="flex h-64 items-center justify-center">
          <div className="space-y-2 text-center">
            <p className="text-red-600">{error}</p>
            <button onClick={handleRefresh} className="text-sm text-zinc-600 underline">
              Reintentar
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-zinc-500">
            {total} conversaci{total === 1 ? "ón" : "ones"}
          </p>

          {items.length === 0 ? (
            <p className="py-12 text-center text-zinc-500">
              No hay conversaciones con estos filtros
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/conversations/${item.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-400"
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-medium text-zinc-900">
                          {displayName(item)}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${channelBadge(item.channel).className}`}
                        >
                          {channelBadge(item.channel).label}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusBadgeClass(item.status)}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      {item.lastMessageText && (
                        <p className="mt-1 line-clamp-2 break-words text-sm text-zinc-600">
                          {item.lastMessageText}
                        </p>
                      )}
                    </div>
                    <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                      <span className="text-xs text-zinc-400">
                        {formatDateTime(item.lastMessageAt)}
                      </span>
                      {item.unreadCount > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                          {item.unreadCount > 99 ? "99+" : item.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {items.length < total && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setOffset((current) => current + PAGE_SIZE)}
                disabled={loadingMore}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
              >
                {loadingMore ? "Cargando..." : "Cargar más"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
