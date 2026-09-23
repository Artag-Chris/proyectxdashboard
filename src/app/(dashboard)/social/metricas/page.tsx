"use client";

import { useEffect, useState } from "react";
import { socialApi } from "@/lib/social-api";
import type { Growth, MetricSnapshot, ObjectiveGap, ObjectiveUnit, PerformanceReport, Profile, Usage } from "@/lib/social-types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Input,
  Loading,
  OBJECTIVE_METRIC_LABEL,
  OBJECTIVE_VERDICT_LABEL,
  OBJECTIVE_VERDICT_TONE,
  ProfilePicker,
  SectionTitle,
  Select,
  Textarea,
  compact,
  fmtDate,
  fmtDateTime,
  useActiveProfile,
} from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Métricas y reportes.
 *
 * Las métricas se cargan a mano (un snapshot o un CSV): es la vía del ADR-002 mientras
 * no haya conector oficial, y es lo que le permite al reporte decir qué funcionó en
 * vez de opinar. El reporte, si no hay métricas, no se arma ni gasta IA.
 */
export default function SocialMetrics() {
  const { data: profiles, reload: reloadProfiles } = usePoll<Profile[]>(() => socialApi.get("/profiles"), 60000);
  const { profileId, select } = useActiveProfile(profiles ?? []);
  const profile = (profiles ?? []).find((candidate) => candidate.id === profileId) ?? null;
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    if (!profile) return;
    if (!profile.accounts.some((account) => account.id === accountId)) {
      setAccountId(profile.accounts[0]?.id ?? "");
    }
  }, [profile, accountId]);

  const { data: snapshots, reload: reloadSnapshots } = usePoll<MetricSnapshot[]>(
    () => (accountId ? socialApi.get(`/accounts/${accountId}/metrics?days=120`) : Promise.resolve([])),
    30000,
    [accountId],
  );
  const { data: reports, reload: reloadReports } = usePoll<PerformanceReport[]>(
    () => (profileId ? socialApi.get(`/profiles/${profileId}/performance?limit=5`) : Promise.resolve([])),
    60000,
    [profileId],
  );
  const { data: usage } = usePoll<Usage>(() => socialApi.get("/usage?days=30"), 60000);
  // El gap de objetivos lo calcula el harness (aritmética, sin IA): se puede refrescar sin
  // pensar en el gasto.
  const { data: growth } = usePoll<Growth | null>(
    () => (profileId ? socialApi.get(`/profiles/${profileId}/growth?days=30`) : Promise.resolve(null)),
    30000,
    [profileId],
  );

  const [snapshot, setSnapshot] = useState({ capturedAt: "", followers: "", reach: "", engagementRate: "" });
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(label: string, call: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await call();
      setMessage(ok);
      reloadSnapshots();
      reloadReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Métricas y reportes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cargá los números de tus cuentas (a mano o pegando un CSV) y el reporte te dice qué funcionó
            y qué ajustar. Reimportar el mismo día actualiza, no duplica.
          </p>
        </div>
        <Button
          disabled={busy || !profileId}
          onClick={() =>
            run(
              "perf",
              () => socialApi.post(`/profiles/${profileId}/performance/run`, { days: 30 }),
              "Reporte encolado. Tarda unos segundos (una llamada de IA).",
            )
          }
        >
          Armar reporte (30 días)
        </Button>
      </div>

      <div className="mt-4">
        <ProfilePicker profiles={profiles ?? []} value={profileId} onChange={select} />
      </div>

      <ErrorBox message={error} />
      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}

      <Card className="mt-4">
        <SectionTitle hint="calculado sobre tu histórico: sin IA y sin costo">
          Objetivos: ¿vas a llegar?
        </SectionTitle>
        {!growth ? (
          <Loading />
        ) : growth.objectives.length === 0 ? (
          <Empty>
            Este perfil no tiene objetivos cargados. Creá uno en «Perfiles» (seguidores, engagement,
            alcance…) y acá te digo cuánto falta y si el ritmo alcanza.
          </Empty>
        ) : (
          <div className="space-y-3">
            {growth.objectives.map((objective) => (
              <div
                key={objective.metric}
                className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-100 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-medium text-zinc-800">
                    {OBJECTIVE_METRIC_LABEL[objective.metric] ?? objective.metric}: objetivo{" "}
                    {fmtObjective(objective.target, objective.unit)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">{gapDetail(objective)}</div>
                </div>
                <Badge tone={OBJECTIVE_VERDICT_TONE[objective.verdict] ?? "zinc"}>
                  {OBJECTIVE_VERDICT_LABEL[objective.verdict] ?? objective.verdict}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {growth && growth.accounts.length > 0 && (
          <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
            <div className="font-medium text-zinc-700">
              Ritmo por cuenta ({growth.windowDays} día(s) en la ventana)
            </div>
            <ul className="mt-1 space-y-0.5">
              {growth.accounts.map((account) => (
                <li key={`${account.platform}-${account.handle}`}>
                  {account.platform} · {account.handle}:{" "}
                  {account.followers
                    ? `${account.followers.from} → ${account.followers.to} (${signed(account.followers.delta)}, ≈ ${signed(account.followers.perWeek)}/semana)`
                    : "sin seguidores cargados en la ventana"}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <div className="mt-2 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle hint="una fila por día, la fecha es obligatoria">Cargar métricas</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cuenta">
              <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {(profile?.accounts ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.platform} · {account.handle}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Día (opcional)" hint="si no, es hoy">
              <Input
                type="date"
                value={snapshot.capturedAt}
                onChange={(event) => setSnapshot({ ...snapshot, capturedAt: event.target.value })}
              />
            </Field>
            <Field label="Seguidores">
              <Input
                type="number"
                value={snapshot.followers}
                onChange={(event) => setSnapshot({ ...snapshot, followers: event.target.value })}
              />
            </Field>
            <Field label="Alcance">
              <Input
                type="number"
                value={snapshot.reach}
                onChange={(event) => setSnapshot({ ...snapshot, reach: event.target.value })}
              />
            </Field>
            <Field label="Engagement (%)">
              <Input
                type="number"
                step="0.1"
                value={snapshot.engagementRate}
                onChange={(event) => setSnapshot({ ...snapshot, engagementRate: event.target.value })}
              />
            </Field>
          </div>
          <div className="mt-2">
            <Button
              variant="secondary"
              disabled={busy || !accountId || (!snapshot.followers && !snapshot.reach && !snapshot.engagementRate)}
              onClick={() =>
                run(
                  "snap",
                  () =>
                    socialApi.post(`/accounts/${accountId}/metrics`, {
                      ...(snapshot.capturedAt ? { capturedAt: snapshot.capturedAt } : {}),
                      ...(snapshot.followers ? { followers: Number(snapshot.followers) } : {}),
                      ...(snapshot.reach ? { reach: Number(snapshot.reach) } : {}),
                      ...(snapshot.engagementRate ? { engagementRate: Number(snapshot.engagementRate) } : {}),
                    }),
                  "Snapshot guardado.",
                ).then(() => setSnapshot({ capturedAt: "", followers: "", reach: "", engagementRate: "" }))
              }
            >
              Guardar el día
            </Button>
          </div>

          <div className="mt-4">
            <Field
              label="O pegar un CSV"
              hint="encabezados: fecha, seguidores, alcance, impresiones, engagement, likes, comentarios, compartidos, guardados"
            >
              <Textarea
                rows={5}
                value={csv}
                onChange={(event) => setCsv(event.target.value)}
                placeholder={"fecha,seguidores,alcance,engagement\n2026-09-01,1000,45000,3.1\n2026-09-02,1040,52000,3.4"}
              />
            </Field>
            <div className="mt-2">
              <Button
                variant="secondary"
                disabled={busy || !accountId || csv.trim().length === 0}
                onClick={() =>
                  run(
                    "csv",
                    () => socialApi.post(`/accounts/${accountId}/metrics`, { csv }),
                    "CSV importado (los días repetidos se actualizaron).",
                  ).then(() => setCsv(""))
                }
              >
                Importar CSV
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle hint={accountId ? "últimos 120 días" : "elegí una cuenta"}>Historial</SectionTitle>
          {!snapshots ? (
            <Loading />
          ) : snapshots.length === 0 ? (
            <Empty>Sin métricas cargadas para esta cuenta.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-1">Día</th>
                    <th className="py-1">Seguidores</th>
                    <th className="py-1">Alcance</th>
                    <th className="py-1">Eng.</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-100">
                      <td className="py-1">{fmtDate(row.capturedAt)}</td>
                      <td className="py-1">{row.followers ?? "—"}</td>
                      <td className="py-1">{row.reach ?? "—"}</td>
                      <td className="py-1">{row.engagementRate !== null ? `${row.engagementRate} %` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {usage && (
            <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
              <div className="font-medium text-zinc-700">Gasto de IA (30 días)</div>
              <div className="mt-1">
                {usage.totals.runs} corrida(s) · {compact(usage.totals.tokensIn)} tokens de entrada ·{" "}
                {compact(usage.totals.tokensOut)} de salida · US$ {usage.totals.costUsd.toFixed(4)}
              </div>
              {usage.totals.costUsd === 0 && usage.totals.runs > 0 && (
                <div className="mt-1 text-zinc-500">
                  El costo sale 0 si el modelo no está en la tabla de precios (`LLM_PRICE_*_PER_1M`).
                </div>
              )}
              <ul className="mt-2 space-y-0.5">
                {usage.byJob.map((job) => (
                  <li key={job.job}>
                    {job.job}: {job.runs} corrida(s) · {compact(job.tokensIn + job.tokensOut)} tokens · latencia{" "}
                    {job.avgLatencyMs} ms
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <SectionTitle hint="lo que dice la IA sobre tus números">Reportes</SectionTitle>
        {!reports ? (
          <Loading />
        ) : reports.length === 0 ? (
          <Empty>
            Sin reportes. Cargá métricas y dale a «Armar reporte»: sin números no se arma (ni gasta IA).
          </Empty>
        ) : (
          <div className="space-y-4">
            {reports.map((report, index) => (
              <div key={report.id} className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <Badge tone={index === 0 ? "emerald" : "zinc"}>
                    {fmtDate(report.periodStart)} → {fmtDate(report.periodEnd)}
                  </Badge>
                  <span>armado el {fmtDateTime(report.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-700">{report.summary}</p>
                {report.whatWorked.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-emerald-700">Qué funcionó</div>
                    <ul className="text-sm text-zinc-600">
                      {report.whatWorked.map((item) => (
                        <li key={item}>· {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.whatDidnt.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-amber-700">Qué no</div>
                    <ul className="text-sm text-zinc-600">
                      {report.whatDidnt.map((item) => (
                        <li key={item}>· {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.adjustments.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-zinc-700">Qué ajustar</div>
                    <ul className="text-sm text-zinc-600">
                      {report.adjustments.map((item) => (
                        <li key={item}>· {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3">
          <Button variant="secondary" onClick={reloadProfiles}>
            Refrescar
          </Button>
        </div>
      </Card>

      <p className="mt-4 text-xs text-zinc-400">
        Las métricas son por cuenta y por día, no por publicación: el reporte lo declara en vez de
        atribuir resultados que no puede sostener.
      </p>
    </div>
  );
}

function unitSuffix(unit: ObjectiveUnit): string {
  if (unit === "PERCENT") return " %";
  if (unit === "PER_WEEK") return "/semana";
  return "";
}

function fmtObjective(value: number, unit: ObjectiveUnit): string {
  return `${value}${unitSuffix(unit)}`;
}

/**
 * Un ritmo por semana. Ojo: en las tasas (`PER_WEEK`) la unidad del objetivo YA es semanal,
 * así que agregarle otro "/semana" daría "1.5/semana/semana".
 */
function fmtPerWeek(value: number, unit: ObjectiveUnit): string {
  const sign = value >= 0 ? "+" : "";
  return unit === "PER_WEEK" ? `${sign}${value}/semana` : `${sign}${value}${unitSuffix(unit)}/semana`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

/** La explicación del veredicto con los números: todo viene calculado del harness. */
function gapDetail(objective: ObjectiveGap): string {
  if (objective.current === null) return "Sin datos para saber dónde estás.";

  const parts = [`hoy ${fmtObjective(objective.current, objective.unit)}`];

  if (objective.remaining !== null && objective.remaining > 0) {
    parts.push(`faltan ${fmtObjective(objective.remaining, objective.unit)}`);
  }
  if (objective.daysLeft !== null) parts.push(`${objective.daysLeft} día(s) de plazo`);
  // En una tasa, "lo que hace falta por semana" no significa nada: ya se ve el ritmo abajo.
  if (objective.neededPerWeek !== null && objective.unit !== "PER_WEEK") {
    parts.push(`necesitás ${fmtPerWeek(objective.neededPerWeek, objective.unit)}`);
  }
  if (objective.currentPerWeek !== null) {
    parts.push(`vas a ${fmtPerWeek(objective.currentPerWeek, objective.unit)}`);
  }
  if (objective.projected !== null) {
    parts.push(`proyección al plazo: ${fmtObjective(objective.projected, objective.unit)}`);
  }

  return parts.join(" · ");
}
