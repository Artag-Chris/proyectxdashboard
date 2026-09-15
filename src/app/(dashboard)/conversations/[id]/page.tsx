"use client";

import { useState, useEffect, useCallback, useRef, startTransition, FormEvent } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { channelBadge } from "@/lib/channel";

type Message = {
  id: string;
  role: string;
  content: unknown;
  createdAt: string;
};

type ApiMessage = {
  id: string;
  role: string;
  content: unknown;
  createdAt: string;
};

type Conversation = {
  id: string;
  channel: string;
  customerIdentifier: string;
  customerName: string | null;
  unreadCount: number;
  status: string;
  messages: Message[];
};

type ApiResponse = {
  conversation: {
    id: string;
    channel: string;
    customerIdentifier: string;
    customerName: string | null;
    unreadCount: number;
    status: string;
  };
  messages: ApiMessage[];
  hasMore?: boolean;
};

const MESSAGE_PAGE_SIZE = 50;

function dedupeById(messages: Message[]): Message[] {
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
}

/** Primer ancestro con scroll vertical (el <main> del layout). */
function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === "auto" || overflowY === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n");
  }
  return JSON.stringify(content);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

function bubbleClass(role: string): string {
  switch (role) {
    case "USER":
      return "bg-zinc-100 text-zinc-900";
    case "ASSISTANT":
      return "bg-zinc-900 text-white";
    case "HUMAN":
      return "bg-emerald-600 text-white";
    default:
      return "bg-zinc-200 text-zinc-600";
  }
}

function bubbleLabel(role: string): string | null {
  if (role === "HUMAN") return "Asistente humano";
  if (role === "ASSISTANT") return "Atiende IA";
  return null;
}

export default function ConversationPage() {
  const params = useParams();
  const id = params.id as string;

  const [conv, setConv] = useState<Conversation | null>(null);
  const [olderMessages, setOlderMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstMessageRef = useRef<HTMLDivElement>(null);

  const lastMessageId = conv?.messages?.length
    ? conv.messages[conv.messages.length - 1].id
    : null;

  // Solo baja al final cuando llega un mensaje nuevo: el polling reemplaza el
  // array cada 10 s y no debe arrastrar la vista mientras se lee historial.
  useEffect(() => {
    if (!lastMessageId) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastMessageId]);

  const fetchConversation = useCallback(async () => {
    try {
      setError("");
      const res = await api.get<ApiResponse>(`/api/dashboard/conversations/${id}`);
      setConv({
        id: res.conversation.id,
        channel: res.conversation.channel,
        customerIdentifier: res.conversation.customerIdentifier,
        customerName: res.conversation.customerName ?? null,
        unreadCount: res.conversation.unreadCount ?? 0,
        status: res.conversation.status,
        messages: res.messages,
      });
      setHasMore(res.hasMore ?? false);
    } catch {
      setError("Error al cargar la conversaci\u00f3n");
    } finally {
      setLoading(false);
    }
  }, [id]);

  /**
   * Carga la página anterior de historial. Ancla el primer mensaje visible para
   * que la lista no salte al insertar contenido arriba.
   */
  const loadOlder = useCallback(async () => {
    if (loadingOlder) return;
    const oldest = dedupeById([...olderMessages, ...(conv?.messages ?? [])])[0];
    if (!oldest) return;

    const container = getScrollParent(firstMessageRef.current);
    const anchorTop = firstMessageRef.current?.getBoundingClientRect().top ?? 0;

    setLoadingOlder(true);
    try {
      setError("");
      const res = await api.get<ApiResponse>(
        `/api/dashboard/conversations/${id}?before=${encodeURIComponent(oldest.createdAt)}&limit=${MESSAGE_PAGE_SIZE}`,
      );
      setOlderMessages((prev) => dedupeById([...(res.messages ?? []), ...prev]));
      setHasMore(res.hasMore ?? false);
      requestAnimationFrame(() => {
        const anchor = firstMessageRef.current;
        if (!container || !anchor) return;
        const delta = anchor.getBoundingClientRect().top - anchorTop;
        if (delta !== 0) container.scrollTop += delta;
      });
    } catch {
      setError("No se pudieron cargar los mensajes anteriores.");
    } finally {
      setLoadingOlder(false);
    }
  }, [conv?.messages, id, loadingOlder, olderMessages]);

  const markRead = useCallback(async () => {
    try {
      await api.post(`/api/dashboard/conversations/${id}/read`);
    } catch {
      // Marcar leído es best-effort; no bloquea el resto.
    }
  }, [id]);

  useEffect(() => {
    startTransition(() => { fetchConversation(); });
  }, [fetchConversation]);

  useEffect(() => {
    markRead();
    const handleVisibility = () => {
      if (!document.hidden) markRead();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [markRead]);

  useEffect(() => {
    if (!conv?.id) return;

    let interval: ReturnType<typeof setInterval>;
    function startPolling() {
      interval = setInterval(() => {
        startTransition(() => { fetchConversation(); });
        if (document.visibilityState === "visible") markRead();
      }, 10000);
    }
    function stopPolling() {
      clearInterval(interval);
    }

    startPolling();
    const handleVisibility = () => {
      stopPolling();
      if (!document.hidden) {
        startPolling();
        startTransition(() => { fetchConversation(); });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [conv?.id, fetchConversation, markRead]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      setError("");
      await api.post(`/api/dashboard/conversations/${id}/send`, { text });
      setDraft("");
      const optimistic: Message = {
        id: `pending-${Date.now()}`,
        role: "HUMAN",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setConv((c) =>
        c ? { ...c, messages: [...c.messages, optimistic] } : c,
      );
      await fetchConversation();
    } catch {
      setError("No se pudo enviar el mensaje. Int\u00e9ntalo de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (resolving) return;
    setResolving(true);
    try {
      setError("");
      await api.post(`/api/dashboard/conversations/${id}/resolve`);
      await fetchConversation();
    } catch {
      setError("No se pudo resolver la conversaci\u00f3n.");
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500">Cargando conversaci&oacute;n...</p>
      </div>
    );
  }

  if (error && !conv) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">Conversaci&oacute;n no encontrada</p>
      </div>
    );
  }

  const isEscalated = conv.status === "ESCALATED";
  const messages = dedupeById([...olderMessages, ...(conv.messages ?? [])]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-start sm:justify-between sm:mb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="text-lg font-bold break-words sm:text-xl">
              {conv.customerName ?? conv.customerIdentifier}
            </h1>
            <span
              className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${channelBadge(conv.channel).className}`}
            >
              {channelBadge(conv.channel).label}
            </span>
          </div>
          {conv.customerName && (
            <p className="text-sm text-zinc-400 break-words">{conv.customerIdentifier}</p>
          )}
          <p className="text-sm text-zinc-500">
            Estado: <span className="capitalize">{conv.status.toLowerCase()}</span>
          </p>
        </div>
        {isEscalated && (
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="w-full shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 sm:w-auto"
          >
            {resolving ? "Resolviendo..." : "Resolver conversaci\u00f3n"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      {isEscalated ? (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          La IA est&aacute; en pausa en esta conversaci&oacute;n. Puedes responderle
          directamente al cliente desde aqu&iacute;.
        </div>
      ) : (
        <div className="mb-4 px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm text-zinc-600">
          Solo lectura &mdash; la IA est&aacute; atendiendo esta conversaci&oacute;n.
        </div>
      )}

      {hasMore && (
        <div className="mb-3 flex justify-center">
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingOlder}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
          >
            {loadingOlder ? "Cargando..." : "Cargar mensajes anteriores"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {messages.map((msg, index) => (
          <div
            key={msg.id}
            ref={index === 0 ? firstMessageRef : undefined}
            className={`flex min-w-0 ${msg.role === "USER" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[85%] min-w-0 break-words rounded-xl px-3 py-2 text-sm sm:px-4 ${bubbleClass(msg.role)}`}
            >
              {bubbleLabel(msg.role) && (
                <p className="text-xs opacity-70 mb-1">{bubbleLabel(msg.role)}</p>
              )}
              <p className="whitespace-pre-wrap">{extractText(msg.content)}</p>
              <p className="text-xs opacity-60 mt-1">{formatDate(msg.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {isEscalated && (
        <form
          onSubmit={handleSend}
          className="sticky bottom-0 -mx-4 mt-6 flex gap-2 border-t border-zinc-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:-mx-6 md:px-6 md:pt-4"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe tu respuesta al cliente..."
            rows={2}
            maxLength={1000}
            className="min-w-0 flex-1 resize-none rounded-xl border border-zinc-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:px-4 sm:text-sm"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="shrink-0 self-end px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </form>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
