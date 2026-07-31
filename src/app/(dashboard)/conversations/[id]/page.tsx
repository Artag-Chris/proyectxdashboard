"use client";

import { useState, useEffect, useCallback, startTransition } from "react";
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

export default function ConversationPage() {
  const params = useParams();
  const id = params.id as string;

  const [conv, setConv] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500">Cargando conversaci\u00f3n...</p>
      </div>
    );
  }

  if (error || !conv) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-600">{error || "Conversaci\u00f3n no encontrada"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{conv.customerIdentifier}</h1>
          <p className="text-sm text-zinc-500">
            Estado: <span className="capitalize">{conv.status.toLowerCase()}</span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {(conv.messages ?? []).map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "USER" ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                msg.role === "USER"
                  ? "bg-zinc-100 text-zinc-900"
                  : msg.role === "ASSISTANT"
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-200 text-zinc-600"
              }`}
            >
              <p className="whitespace-pre-wrap">{extractText(msg.content)}</p>
              <p className="text-xs opacity-60 mt-1">{formatDate(msg.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
