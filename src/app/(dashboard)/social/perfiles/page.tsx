"use client";

import { useEffect, useState } from "react";
import { socialApi } from "@/lib/social-api";
import { GoButton } from "@/lib/social-setup";
import type { PlatformDef, Profile } from "@/lib/social-types";
import {
  Badge,
  Button,
  Card,
  ErrorBox,
  Field,
  Input,
  Loading,
  SectionTitle,
  Select,
  Textarea,
  useActiveProfile,
} from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Perfiles: el "para quién" del coach. El nicho es el dato que más cambia el
 * resultado del análisis de relevancia, así que se edita acá.
 */
const CADENCES = [null, 1, 3, 6, 12, 24, 72];

const OBJECTIVE_METRICS = [
  "FOLLOWERS",
  "ENGAGEMENT_RATE",
  "REACH",
  "POSTS_PUBLISHED",
  "LEADS",
  "SALES",
  "SAVES",
  "COMMENTS",
];

export default function SocialProfiles() {
  const { data: profiles, error: pollError, reload } = usePoll<Profile[]>(() => socialApi.get("/profiles"), 30000);
  const { data: platforms } = usePoll<PlatformDef[]>(() => socialApi.get("/platforms"), 300000);
  const { profileId, select } = useActiveProfile(profiles ?? []);
  const profile = (profiles ?? []).find((candidate) => candidate.id === profileId) ?? null;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", niche: "", audience: "", voice: "" });
  const [accountForm, setAccountForm] = useState({ platform: "LINKEDIN", handle: "", url: "" });
  const [objectiveForm, setObjectiveForm] = useState({ metric: "FOLLOWERS", targetValue: "1000" });

  const [form, setForm] = useState({
    name: "",
    niche: "",
    audience: "",
    voice: "",
    language: "es",
    scheduleHours: "",
    ideasPerWeek: "3",
    autoIdeasEnabled: true,
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name,
      niche: profile.niche.join(", "),
      audience: profile.audience ?? "",
      voice: profile.voice ?? "",
      language: profile.language,
      scheduleHours: profile.scheduleHours ? String(profile.scheduleHours) : "",
      ideasPerWeek: String(profile.ideasPerWeek),
      autoIdeasEnabled: profile.autoIdeasEnabled,
    });
  }, [profile?.id, profile?.name, profile?.niche, profile?.audience, profile?.voice, profile?.language, profile?.scheduleHours, profile?.ideasPerWeek, profile?.autoIdeasEnabled, profile]);

  async function run(label: string, call: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await call();
      setMessage(ok);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const niche = form.niche
    .split(",")
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Perfiles</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cada perfil tiene su nicho, sus redes y sus objetivos. El análisis de relevancia se hace
            contra el nicho, así que vale la pena afinarlo.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setCreating((value) => !value)}>
          {creating ? "Cancelar" : "Nuevo perfil"}
        </Button>
      </div>

      {creating && (
        <Card className="mt-4">
          <SectionTitle hint="después se edita todo">Crear perfil</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre">
              <Input
                value={newProfile.name}
                onChange={(event) => setNewProfile({ ...newProfile, name: event.target.value })}
                placeholder="Mi marca personal"
              />
            </Field>
            <Field label="Nicho (separado por comas)" hint="ej: inteligencia artificial, pymes, automatización">
              <Input
                value={newProfile.niche}
                onChange={(event) => setNewProfile({ ...newProfile, niche: event.target.value })}
              />
            </Field>
            <Field label="Audiencia">
              <Input
                value={newProfile.audience}
                onChange={(event) => setNewProfile({ ...newProfile, audience: event.target.value })}
                placeholder="dueños de pymes en LatAm"
              />
            </Field>
            <Field label="Tono / voz">
              <Input
                value={newProfile.voice}
                onChange={(event) => setNewProfile({ ...newProfile, voice: event.target.value })}
                placeholder="directo, sin humo, con ejemplos reales"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button
              disabled={busy || newProfile.name.trim().length < 2}
              onClick={() =>
                run(
                  "create",
                  () =>
                    socialApi.post("/profiles", {
                      name: newProfile.name.trim(),
                      niche: newProfile.niche
                        .split(",")
                        .map((term) => term.trim())
                        .filter((term) => term.length >= 2),
                      ...(newProfile.audience.trim() ? { audience: newProfile.audience.trim() } : {}),
                      ...(newProfile.voice.trim() ? { voice: newProfile.voice.trim() } : {}),
                    }),
                  "Perfil creado.",
                ).then(() => {
                  setCreating(false);
                  setNewProfile({ name: "", niche: "", audience: "", voice: "" });
                })
              }
            >
              Crear
            </Button>
          </div>
        </Card>
      )}

      <ErrorBox message={error ?? pollError} />
      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}

      {!profiles ? (
        <Loading />
      ) : profiles.length === 0 ? (
        <Card className="mt-4">
          <SectionTitle hint="con el nombre ya alcanza para entrar">Todavía no hay perfiles</SectionTitle>
          <p className="text-sm text-zinc-600">
            Sin perfil el harness no sabe a quién le hablás. La guía te pregunta lo mínimo en 3 pasos
            (y guarda cada uno); si preferís cargarlo a mano, el formulario de arriba hace lo mismo.
          </p>
          <div className="mt-3">
            <GoButton href="/social/empezar">Ir a la guía de 3 pasos</GoButton>
          </div>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {profiles.map((item) => (
            <Card key={item.id} className={item.id === profileId ? "border-emerald-400" : ""}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <button onClick={() => select(item.id)} className="text-sm font-medium hover:underline">
                    {item.name}
                  </button>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <Badge tone="zinc">{item.accounts.length} cuenta(s)</Badge>
                    <Badge tone="zinc">{item._count.ideas} idea(s)</Badge>
                    <Badge tone="zinc">{item._count.profileSignals} señal(es)</Badge>
                    <span>{item.scheduleHours ? `cada ${item.scheduleHours} h` : "solo manual"}</span>
                    {item.autoIdeasEnabled && <Badge tone="emerald">ideas automáticas</Badge>}
                  </div>
                </div>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`¿Borrar "${item.name}"? Se van sus ideas, señales y borradores.`)) {
                      void run("del", () => socialApi.del(`/profiles/${item.id}`), "Perfil borrado.");
                    }
                  }}
                >
                  Borrar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {profile && (
        <>
          <Card className="mt-4">
            <SectionTitle hint={profile.name}>Nicho, audiencia y ritmo</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre">
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Nicho (separado por comas)" hint={`${niche.length} tema(s)`}>
                <Input value={form.niche} onChange={(event) => setForm({ ...form, niche: event.target.value })} />
              </Field>
              <Field label="Audiencia">
                <Input value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })} />
              </Field>
              <Field label="Tono / voz">
                <Textarea rows={2} value={form.voice} onChange={(event) => setForm({ ...form, voice: event.target.value })} />
              </Field>
              <Field label="Cadencia de recolección" hint="el ciclo del scheduler revisa quién toca">
                <Select
                  value={form.scheduleHours}
                  onChange={(event) => setForm({ ...form, scheduleHours: event.target.value })}
                >
                  {CADENCES.map((hours) => (
                    <option key={String(hours)} value={hours === null ? "" : String(hours)}>
                      {hours === null ? "solo manual" : `cada ${hours} h`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ideas por corrida" hint="el freno de costo de la IA">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.ideasPerWeek}
                  onChange={(event) => setForm({ ...form, ideasPerWeek: event.target.value })}
                />
              </Field>
              <Field label="Idioma">
                <Input value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} />
              </Field>
              <Field label="Generación automática de ideas">
                <Select
                  value={form.autoIdeasEnabled ? "si" : "no"}
                  onChange={(event) => setForm({ ...form, autoIdeasEnabled: event.target.value === "si" })}
                >
                  <option value="si">Sí: cuando una señal pasa el umbral</option>
                  <option value="no">No: solo cuando la pido</option>
                </Select>
              </Field>
            </div>
            <div className="mt-3">
              <Button
                disabled={busy}
                onClick={() =>
                  run(
                    "save",
                    () =>
                      socialApi.patch(`/profiles/${profile.id}`, {
                        name: form.name.trim(),
                        niche,
                        audience: form.audience.trim() || null,
                        voice: form.voice.trim() || null,
                        language: form.language.trim() || "es",
                        scheduleHours: form.scheduleHours ? Number(form.scheduleHours) : null,
                        ideasPerWeek: Number(form.ideasPerWeek) || 3,
                        autoIdeasEnabled: form.autoIdeasEnabled,
                      }),
                    "Perfil actualizado.",
                  )
                }
              >
                Guardar
              </Button>
            </div>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle hint="donde publica">Cuentas</SectionTitle>
              <ul className="space-y-2">
                {profile.accounts.length === 0 && (
                  <li className="text-sm text-zinc-400">
                    Sin cuentas: el coach no va a saber en qué red sugerir.
                  </li>
                )}
                {profile.accounts.map((account) => (
                  <li key={account.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0">
                    <span className="text-sm">
                      <Badge tone="zinc">
                        {platforms?.find((platform) => platform.key === account.platform)?.label ?? account.platform}
                      </Badge>{" "}
                      {account.handle}
                    </span>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        run("acc-del", () => socialApi.del(`/profiles/${profile.id}/accounts/${account.id}`), "Cuenta quitada.")
                      }
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Select
                  value={accountForm.platform}
                  onChange={(event) => setAccountForm({ ...accountForm, platform: event.target.value })}
                >
                  {(platforms ?? []).map((platform) => (
                    <option key={platform.key} value={platform.key}>
                      {platform.label}
                    </option>
                  ))}
                </Select>
                <Input
                  value={accountForm.handle}
                  onChange={(event) => setAccountForm({ ...accountForm, handle: event.target.value })}
                  placeholder="@usuario"
                />
                <Input
                  value={accountForm.url}
                  onChange={(event) => setAccountForm({ ...accountForm, url: event.target.value })}
                  placeholder="https://… (opcional)"
                />
              </div>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  disabled={busy || accountForm.handle.trim().length === 0}
                  onClick={() =>
                    run(
                      "acc",
                      () =>
                        socialApi.post(`/profiles/${profile.id}/accounts`, {
                          platform: accountForm.platform,
                          handle: accountForm.handle.trim(),
                          ...(accountForm.url.trim() ? { url: accountForm.url.trim() } : {}),
                        }),
                      "Cuenta agregada.",
                    ).then(() => setAccountForm({ ...accountForm, handle: "", url: "" }))
                  }
                >
                  Agregar cuenta
                </Button>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Sumar o quitar una red es esto: una cuenta más. El catálogo de redes vive en el harness,
                así que no hay que migrar nada.
              </p>
            </Card>

            <Card>
              <SectionTitle hint="contra esto se mide el reporte">Objetivos</SectionTitle>
              <ul className="space-y-2">
                {profile.objectives.length === 0 && (
                  <li className="text-sm text-zinc-400">Sin objetivos: el reporte no puede decir si vas bien.</li>
                )}
                {profile.objectives.map((objective) => (
                  <li key={objective.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0">
                    <span className="text-sm">
                      {objective.metric.toLowerCase()} → {objective.targetValue}
                      {objective.currentValue !== null && ` (hoy: ${objective.currentValue})`}
                      {objective.dueDate && ` · para ${objective.dueDate.slice(0, 10)}`}
                    </span>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        run("obj-del", () => socialApi.del(`/profiles/${profile.id}/objectives/${objective.id}`), "Objetivo quitado.")
                      }
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Select
                  value={objectiveForm.metric}
                  onChange={(event) => setObjectiveForm({ ...objectiveForm, metric: event.target.value })}
                >
                  {OBJECTIVE_METRICS.map((metric) => (
                    <option key={metric} value={metric}>
                      {metric.toLowerCase()}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  value={objectiveForm.targetValue}
                  onChange={(event) => setObjectiveForm({ ...objectiveForm, targetValue: event.target.value })}
                  placeholder="meta"
                />
              </div>
              <div className="mt-2">
                <Button
                  variant="secondary"
                  disabled={busy || Number(objectiveForm.targetValue) <= 0}
                  onClick={() =>
                    run(
                      "obj",
                      () =>
                        socialApi.post(`/profiles/${profile.id}/objectives`, {
                          metric: objectiveForm.metric,
                          targetValue: Number(objectiveForm.targetValue),
                        }),
                      "Objetivo agregado.",
                    )
                  }
                >
                  Agregar objetivo
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
