"use client";

import { useState } from "react";
import { Button, ErrorBox } from "@/lib/social-ui";
import { docsApi } from "@/lib/docs-api";
import { ANONYMIZE_KIND_LABEL } from "@/lib/docs-ui";
import type { AnonymizeEntity } from "@/lib/docs-types";

/**
 * Detección y reemplazo de datos personales. La IA PROPONE (la detección), pero el
 * reemplazo lo aprueba el usuario celda por celda y el harness lo aplica literal:
 * el usuario manda, la IA asesora.
 */
export function AnonymizePanel({ jobId, onApplied }: { jobId: string; onApplied: () => void }) {
  const [entities, setEntities] = useState<AnonymizeEntity[] | null>(null);
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await docsApi.post<{ entities: AnonymizeEntity[] }>(
        `/jobs/${jobId}/anonymize/scan`,
      );
      setEntities(result.entities);
      setReplacements(
        Object.fromEntries(result.entities.map((entity) => [entity.value, entity.placeholder])),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const mapping = Object.fromEntries(
        Object.entries(replacements).filter(([from, to]) => from.length > 0 && to.trim().length > 0),
      );
      await docsApi.post(`/jobs/${jobId}/anonymize/apply`, { mapping });
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={scan} disabled={busy}>
          {busy ? "Analizando…" : "Detectar datos personales"}
        </Button>
        {entities && entities.length > 0 && (
          <Button onClick={apply} disabled={busy}>
            Aplicar reemplazos
          </Button>
        )}
      </div>

      <ErrorBox message={error} />

      {entities && entities.length === 0 && (
        <p className="text-sm text-zinc-400">No se detectaron datos para reemplazar.</p>
      )}

      {entities && entities.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="p-2">Tipo</th>
                <th className="p-2">Detectado</th>
                <th className="p-2">Reemplazo</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((entity) => (
                <tr key={entity.value} className="border-t border-zinc-100">
                  <td className="p-2 text-zinc-500">
                    {ANONYMIZE_KIND_LABEL[entity.kind] ?? entity.kind}
                  </td>
                  <td className="p-2 font-mono text-xs">{entity.value}</td>
                  <td className="p-2">
                    <input
                      value={replacements[entity.value] ?? ""}
                      onChange={(e) =>
                        setReplacements((current) => ({ ...current, [entity.value]: e.target.value }))
                      }
                      className="w-full rounded border border-zinc-300 px-2 py-1"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
