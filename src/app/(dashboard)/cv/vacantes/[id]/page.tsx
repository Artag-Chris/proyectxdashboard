"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cvApi } from "@/lib/cv-api";
import { Card, Score, StatusBadge } from "@/lib/cv-ui";
import type { VacancyDetail } from "@/lib/cv-types";

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-zinc-600">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export default function CvVacanteDetalle() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Perfil cuya evaluación se muestra (llega desde el listado filtrado).
  const profileId = searchParams.get("profileId") ?? "";

  const [vac, setVac] = useState<VacancyDetail | null>(null);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const query = profileId ? `?profileId=${profileId}` : "";
      const v = await cvApi.get<VacancyDetail>(`/vacancies/${id}${query}`);
      setVac(v);
      setSummary((v.resume?.content.summary as string) ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profileId]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!vac) return <p className="text-zinc-400">Cargando vacante…</p>;

  const applyUrl = (vac.raw.applyUrl as string | undefined) ?? vac.url;
  // Con un perfil elegido, el estado mostrado es el SUYO (aplicada/ignorada es
  // por perfil, no global).
  const scopedProfile = profileId
    ? (vac.profiles.find((p) => p.profileId === profileId) ?? null)
    : null;
  const shownStatus = scopedProfile?.status ?? vac.status;

  function selectProfile(nextProfileId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("profileId", nextProfileId);
    router.replace(`/cv/vacantes/${id}?${next.toString()}`);
  }

  async function setStatus(status: "APPLIED" | "IGNORED") {
    if (!vac) return;
    await cvApi.post(`/vacancies/${vac.id}/status`, {
      status,
      // Sin perfil, el API solo puede resolverlo si hay un único perfil.
      ...(profileId ? { profileId } : {}),
    });
    await load();
  }

  async function saveSummary() {
    if (!vac?.resume) return;
    const content = { ...vac.resume.content, summary };
    await cvApi.patch(`/resumes/${vac.resume.id}`, { content });
    setMsg("Resumen de la HV guardado.");
    await load();
  }

  async function copyMarkdown() {
    if (!vac?.resume) return;
    const md = (vac.resume.content.markdown as string | undefined) ?? "";
    if (!md) return;
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="max-w-5xl">
      <Link href="/cv/vacantes" className="text-sm text-zinc-500 hover:text-zinc-700">
        ← Vacantes
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{vac.title}</h1>
        <StatusBadge status={shownStatus} />
        <Score score={vac.matchScore} />
      </div>
      <p className="text-sm text-zinc-500">
        {[vac.company, vac.location, vac.salary, vac.modality].filter(Boolean).join(" · ") || "—"}
        <span className="ml-2 text-zinc-400">· {vac.source.name}</span>
      </p>

      {vac.profiles.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Evaluación de:</span>
          {vac.profiles.map((p) => {
            const active = p.profileId === profileId;
            return (
              <button
                key={p.profileId}
                onClick={() => selectProfile(p.profileId)}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {p.profileName}
                {p.score !== null ? ` · ${p.score}%` : " · sin match"}
              </button>
            );
          })}
          {profileId && (
            <button
              onClick={() => router.replace(`/cv/vacantes/${id}`)}
              className="text-xs text-zinc-400 underline hover:text-zinc-600"
            >
              ver el mejor match
            </button>
          )}
        </div>
      )}

      {scopedProfile && (
        <p className="mt-2 text-xs text-emerald-700">
          Mostrando el match y la HV de <b>{scopedProfile.profileName}</b>. El estado
          aplicada/ignorada también es suyo.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={applyUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Aplicar ↗
        </a>
        {shownStatus !== "APPLIED" && (
          <button
            onClick={() => void setStatus("APPLIED")}
            className="rounded-lg border border-violet-300 px-3 py-1.5 text-sm hover:bg-violet-50"
          >
            Marcar aplicada
            {scopedProfile ? ` (${scopedProfile.profileName})` : ""}
          </button>
        )}
        {shownStatus !== "IGNORED" && (
          <button
            onClick={() => void setStatus("IGNORED")}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50"
          >
            Ignorar
            {scopedProfile ? ` (${scopedProfile.profileName})` : ""}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold text-emerald-700">Vacante (enriquecida)</h2>
            {vac.enrichment?.summary && (
              <p className="mt-2 text-sm text-zinc-600">{vac.enrichment.summary}</p>
            )}
            {vac.enrichment?.seniority && (
              <p className="mt-1 text-xs text-zinc-400">Seniority: {vac.enrichment.seniority}</p>
            )}
            <ListBlock title="Requisitos clave" items={vac.enrichment?.keyRequirements} />
            <ListBlock title="Deseables" items={vac.enrichment?.niceToHave} />
            <ListBlock title="Skills detectadas" items={vac.enrichment?.skills} />
          </Card>
        </div>

        <div className="space-y-4">
          {vac.match && (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-emerald-700">
                  Match {vac.match.score}/100 · {vac.match.verdict}
                  {scopedProfile ? ` · ${scopedProfile.profileName}` : ""}
                </h2>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Análisis IA {vac.match.analysisScore ?? "—"} · Similitud CV{" "}
                {vac.match.semanticScore ?? "sin HV activa"} · Final {vac.match.score}
              </p>
              <ListBlock title="Razones" items={vac.match.reasons} />
              <ListBlock title="Brechas" items={vac.match.gaps} />
              <div className="mt-3 border-t border-zinc-100 pt-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Ángulo</div>
                <p className="mt-1 text-sm text-zinc-600">{vac.match.applicationStrategy.angle}</p>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Canal sugerido
                </div>
                <p className="mt-1 text-sm text-zinc-600">
                  {vac.match.applicationStrategy.suggestedChannel}
                </p>
                <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Keywords ATS
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {(vac.match.applicationStrategy.keywords ?? []).join(", ")}
                </p>
              </div>
              {vac.match.coverLetterDraft && (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Carta de presentación
                  </div>
                  <p className="mt-1 text-sm italic text-zinc-600">{vac.match.coverLetterDraft}</p>
                </div>
              )}
            </Card>
          )}

          {vac.match === null && scopedProfile && (
            <Card>
              <h2 className="text-sm font-semibold text-emerald-700">Sin evaluación</h2>
              <p className="mt-2 text-sm text-zinc-500">
                {scopedProfile.profileName} todavía no tiene un match calculado para esta vacante.
                Probá «Re-evaluar vacantes» en Perfiles.
              </p>
            </Card>
          )}

          {vac.resume && (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-emerald-700">
                  Borrador de HV · v{vac.resume.version}
                  {scopedProfile ? ` · ${scopedProfile.profileName}` : ""}
                </h2>
                <button
                  onClick={() => void copyMarkdown()}
                  className="rounded-lg border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                >
                  {copied ? "¡Copiado!" : "Copiar markdown"}
                </button>
              </div>
              <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Resumen (editable)
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => void saveSummary()}
                className="mt-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Guardar resumen
              </button>
              {msg && <p className="mt-1 text-xs text-emerald-600">{msg}</p>}
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                {(vac.resume.content.markdown as string | undefined) ?? ""}
              </pre>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
