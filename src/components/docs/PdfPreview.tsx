"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ErrorBox } from "@/lib/social-ui";
import { docsApi } from "@/lib/docs-api";

/**
 * Vista previa del PDF REAL (lo renderiza el backend desde el contenido actual),
 * así lo que se ve es exactamente lo que se descarga. Se muestra embebida y se
 * puede abrir en un pop-out para verla grande.
 */
export function PdfPreview({ jobId, version }: { jobId: string; version: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await docsApi.blobUrl(`/jobs/${jobId}/preview`);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = next;
      setUrl(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, version]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={refresh} disabled={busy}>
          {busy ? "Renderizando…" : "Actualizar vista previa"}
        </Button>
        {url && (
          <Button variant="ghost" onClick={() => window.open(url, "_blank", "noopener")}>
            Abrir en pestaña nueva
          </Button>
        )}
      </div>
      <ErrorBox message={error} />
      {url ? (
        <iframe
          title="Vista previa"
          src={url}
          className="h-[70vh] w-full rounded-lg border border-zinc-200 bg-white"
        />
      ) : (
        <p className="py-6 text-center text-sm text-zinc-400">Sin vista previa todavía.</p>
      )}
    </div>
  );
}
