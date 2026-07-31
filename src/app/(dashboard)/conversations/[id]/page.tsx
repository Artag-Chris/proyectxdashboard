"use client";

import { useState, useEffect, useCallback, startTransition, FormEvent } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

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
  customerIdentifier: string;
  status: string;
  messages: Message[];
};

type ApiResponse = {
  conversation: {
    id: string;
    customerIdentifier: string;
    status: string;
  };
  messages: ApiMessage[];
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  const fetchConversation = useCallback(async () => {
    try {
      setError("");
      const res = await api.get<ApiResponse>(`/api/dashboard/conversations/${id}`);
      setConv({
        id: res.conversation.id,
        customerIdentifier: res.conversation.customerIdentifier,
        status: res.conversation.status,
        messages: res.messages,
      });
    } catch {
      setError("Error al cargar la conversaci\u00f3n");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    startTransition(() => { fetchConversation(); });
  }, [fetchConversation]);

  useEffect(() => {
    if (conv?.status !== "ESCALATED") return;

    let interval: ReturnType<typeof setInterval>;
    function startPolling() {
      interval = setInterval(() => {
        startTransition(() => { fetchConversation(); });
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
  }, [conv?.status, conv?.id, fetchConversation]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      setError("");
      await api.post(`/api/dashboard/conversations/${id}/send`, { text });
      setDraft("");
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
        <p className="text-zinc-500">Cargando conversaci\u00f3n...</p>
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
        <p className="text-red-600">Conversaci\u00f3n no encontrada</p>
      </div>
    );
  }

  const isEscalated = conv.status === "ESCALATED";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{conv.customerIdentifier}</h1>
          <p className="text-sm text-zinc-500">
            Estado: <span className="capitalize">{conv.status.toLowerCase()}</span>
          </p>
        </div>
        {isEscalated && (
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {resolving ? "Resolviendo..." : "Resolver conversaci\u00f3n"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      {isEscalated && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          La IA est\u00e1 en pausa en esta conversaci\u00f3n. Puedes responderle
          directamente al cliente desde aqu\u00ed.
        </div>
      )}

      <div className="space-y-3">
        {(conv.messages ?? []).map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "USER" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${bubbleClass(msg.role)}`}
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
          className="sticky bottom-0 mt-6 bg-white border-t border-zinc-200 pt-4 flex gap-2"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe tu respuesta al cliente..."
            rows={2}
            maxLength={1000}
            className="flex-1 resize-none rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 self-end"
          >
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </form>
      )}
    </div>
  );
}
