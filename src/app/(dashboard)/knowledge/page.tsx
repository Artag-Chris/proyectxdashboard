"use client";

import { useState, useEffect, useCallback, startTransition, useRef } from "react";
import { api } from "@/lib/api";

type Document = {
  id: string;
  kind: string;
  title: string;
  source: string;
  status: string;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
};

const KNOWLEDGE_KINDS = ["FAQ", "POLICY", "PDF_CATALOG", "MANUAL", "NOTES", "OTHER"] as const;

const KIND_LABELS: Record<string, string> = {
  FAQ: "FAQ",
  POLICY: "Pol\u00edtica",
  PDF_CATALOG: "Cat\u00e1logo PDF",
  MANUAL: "Manual",
  NOTES: "Notas",
  OTHER: "Otro",
};

function statusColor(status: string): string {
  switch (status) {
    case "INDEXED":
      return "bg-green-100 text-green-700";
    case "FAILED":
      return "bg-red-100 text-red-700";
    case "PENDING":
    case "EXTRACTING":
    case "CHUNKING":
    case "EMBEDDING":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function KnowledgePage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<"text" | "file">("text");

  const [kind, setKind] = useState<string>("FAQ");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      setError("");
      const res = await api.get<Document[]>("/api/knowledge");
      setDocs(res);
    } catch {
      setError("Error al cargar documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => { fetchDocs(); });
  }, [fetchDocs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (tab === "file") {
      if (!file) {
        setSubmitError("Selecciona un archivo");
        return;
      }
      setSubmitting(true);
      try {
        const fd = new FormData();
        fd.append("kind", kind);
        fd.append("title", title || file.name);
        fd.append("file", file);
        await api.upload("/api/knowledge/upload", fd);
        setShowModal(false);
        resetForm();
        fetchDocs();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Error al subir archivo");
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!source || !text) {
        setSubmitError("Completa todos los campos");
        return;
      }
      setSubmitting(true);
      try {
        await api.post("/api/knowledge/text", {
          kind,
          title: title || source,
          source,
          text,
        });
        setShowModal(false);
        resetForm();
        fetchDocs();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Error al agregar texto");
      } finally {
        setSubmitting(false);
      }
    }
  }

  function resetForm() {
    setKind("FAQ");
    setTitle("");
    setSource("");
    setText("");
    setFile(null);
    setSubmitError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(id: string) {
    if (!confirm("\u00bfEliminar este documento?")) return;
    try {
      await api.delete(`/api/knowledge/${id}`);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError("Error al eliminar");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-zinc-500">Cargando documentos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-red-600">{error}</p>
          <button onClick={fetchDocs} className="text-sm text-zinc-600 underline">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Conocimiento</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-700 transition-colors"
        >
          Agregar
        </button>
      </div>

      {docs.length === 0 ? (
        <p className="text-zinc-500 text-center py-12">
          No hay documentos de conocimiento
        </p>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl shadow-sm border border-zinc-200 p-4 flex items-start justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm truncate">{doc.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 shrink-0">
                    {KIND_LABELS[doc.kind] ?? doc.kind}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 truncate">{doc.source}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(doc.status)}`}>
                    {doc.status}
                  </span>
                  {doc.chunkCount > 0 && (
                    <span className="text-xs text-zinc-400">{doc.chunkCount} chunks</span>
                  )}
                  <span className="text-xs text-zinc-400">{formatDate(doc.createdAt)}</span>
                </div>
                {doc.errorMessage && (
                  <p className="text-xs text-red-500 mt-1">{doc.errorMessage}</p>
                )}
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-xs text-red-500 hover:text-red-700 ml-4 shrink-0"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-bold mb-4">Agregar conocimiento</h2>

            <div className="flex gap-1 mb-4 bg-zinc-100 rounded-lg p-1">
              <button
                onClick={() => setTab("text")}
                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                  tab === "text" ? "bg-white shadow-sm font-medium" : "text-zinc-600"
                }`}
              >
                Texto
              </button>
              <button
                onClick={() => setTab("file")}
                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                  tab === "file" ? "bg-white shadow-sm font-medium" : "text-zinc-600"
                }`}
              >
                Archivo
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Tipo</label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                >
                  {KNOWLEDGE_KINDS.map((k) => (
                    <option key={k} value={k}>{KIND_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">T\u00edtulo</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={tab === "file" ? "Opcional — por defecto nombre del archivo" : ""}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              {tab === "text" ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">
                      Identificador
                    </label>
                    <input
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="ej: horarios-verano"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Texto</label>
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-y"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">
                    Archivo (PDF o CSV)
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:text-sm file:font-medium hover:file:bg-zinc-200"
                  />
                  <p className="text-xs text-zinc-400 mt-1">M\u00e1ximo 20 MB</p>
                </div>
              )}

              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm hover:bg-zinc-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
