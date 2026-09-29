"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { socialApi } from "@/lib/social-api";
import { GoButton, SetupChecklist } from "@/lib/social-setup";
import type { PlatformDef, Profile } from "@/lib/social-types";
import { Button, Card, ErrorBox, Field, Input, OBJECTIVE_METRIC_LABEL, SectionTitle, Select, Textarea } from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Alta guiada del primer perfil.
 *
 * Tres pasos y **cada uno guarda**: si se abandona en el segundo, el perfil ya existe (y el
 * checklist de Resumen sigue desde donde quedó). Los pasos 2 y 3 se pueden saltear porque
 * el harness anda igual sin ellos — lo que hace es avisar qué falta cuando haga falta.
 *
 * El orden no es decorativo: 1 habilita al coach de contenido y al de comunidad (nichos y
 * audiencia), 2 habilita métricas y crecimiento, 3 habilita «¿vas a llegar?».
 */

const STEPS = ["Lo básico", "Dónde publicás", "Qué querés lograr"];

const METRIC_OPTIONS = ["POSTS_PER_WEEK", "ENGAGEMENT_RATE", "FOLLOWERS", "REACH", "LEADS"];

export default function SocialStart() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", niche: "", audience: "", voice: "" });
  const [created, setCreated] = useState<Profile | null>(null);

  const [accounts, setAccounts] = useState<Array<{ platform: string; handle: string }>>([]);
  const [accountForm, setAccountForm] = useState({ platform: "INSTAGRAM", handle: "" });

  const [objective, setObjective] = useState({ metric: "POSTS_PER_WEEK", target: "3", days: "90" });
  const [objectives, setObjectives] = useState<Array<{ metric: string; target: number }>>([]);

  const { data: platforms } = usePoll<PlatformDef[]>(() => socialApi.get("/platforms"), 300000);

  async function run(call: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await call();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const createProfile = () =>
    run(async () => {
      const profile = await socialApi.post<Profile>("/profiles", {
        name: form.name.trim(),
        niche: form.niche
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        ...(form.audience.trim() ? { audience: form.audience.trim() } : {}),
        ...(form.voice.trim() ? { voice: form.voice.trim() } : {}),
      });

      // Que la pestaña entera quede mirando este perfil, y que el layout se entere ya
      // (sin esperar el sondeo) para que las pestañas vuelvan a aparecer.
      window.localStorage.setItem("social_profile", profile.id);
      window.dispatchEvent(new Event("social:profiles-changed"));
      setCreated(profile);
      setStep(2);
    });

  const addAccount = () =>
    run(async () => {
      if (!created) return;
      await socialApi.post(`/profiles/${created.id}/accounts`, {
        platform: accountForm.platform,
        handle: accountForm.handle.trim(),
      });
      setAccounts([...accounts, { platform: accountForm.platform, handle: accountForm.handle.trim() }]);
      setAccountForm({ platform: accountForm.platform, handle: "" });
    });

  const addObjective = () =>
    run(async () => {
      if (!created) return;
      const days = Number(objective.days) || 90;
      const metric = objective.metric;
      await socialApi.post(`/profiles/${created.id}/objectives`, {
        metric,
        targetValue: Number(objective.target) || 1,
        dueDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      });
      setObjectives([...objectives, { metric, target: Number(objective.target) || 1 }]);
      setStep(4);
    });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const active = step === number;
          const done = step > number;
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                  active
                    ? "bg-emerald-600 text-white"
                    : done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {done ? "✓" : number}
              </span>
              <span className={`text-sm ${active ? "text-zinc-800" : "text-zinc-400"}`}>{label}</span>
              {number < STEPS.length && <span className="text-zinc-300">→</span>}
            </div>
          );
        })}
      </div>

      <ErrorBox message={error} />

      {step === 1 && (
        <Card>
          <SectionTitle hint="es lo único obligatorio; los otros dos pasos se pueden saltear">
            Paso 1 · Lo básico
          </SectionTitle>
          <p className="mb-3 text-sm text-zinc-600">
            Todavía no hay ningún perfil, y sin perfil no hay nada que el harness pueda hacer: no sabe
            a quién le hablás. Con el nombre ya alcanza para entrar; el nicho y la audiencia son lo que
            hace que las ideas y los segmentos salgan con sentido.
          </p>
          <div className="grid gap-3">
            <Field label="Nombre del perfil o de la marca">
              <Input
                value={form.name}
                placeholder="Mi marca personal"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </Field>
            <Field label="Nicho" hint="separado por comas: tecnología, inteligencia artificial, pymes">
              <Input
                value={form.niche}
                placeholder="tecnología, inteligencia artificial, pymes"
                onChange={(event) => setForm({ ...form, niche: event.target.value })}
              />
            </Field>
            <Field
              label="¿A quién le hablás?"
              hint="una frase alcanza: a quién, de dónde y con qué problema"
            >
              <Textarea
                rows={2}
                value={form.audience}
                placeholder="Profesionales y pymes de LatAm que quieren aplicar IA sin humo"
                onChange={(event) => setForm({ ...form, audience: event.target.value })}
              />
            </Field>
            <Field label="Tono (opcional)" hint="cómo querés sonar: lo usan los guiones">
              <Input
                value={form.voice}
                placeholder="directo, técnico y cercano; sin relleno"
                onChange={(event) => setForm({ ...form, voice: event.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button disabled={busy || form.name.trim().length < 2} onClick={createProfile}>
              {busy ? "Creando…" : "Crear perfil y seguir"}
            </Button>
          </div>
        </Card>
      )}

      {step === 2 && created && (
        <Card>
          <SectionTitle hint="podés cargar varias; es lo que después te deja medir">
            Paso 2 · Dónde publicás
          </SectionTitle>
          <p className="mb-3 text-sm text-zinc-600">
            Cargá al menos una cuenta (tu Instagram, TikTok, YouTube, LinkedIn…). Sin cuentas el harness
            no tiene dónde anotar métricas, así que no hay reporte ni forma de saber si crecés. Podés
            saltearlo y agregarlas cuando quieras desde Perfiles.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Red">
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
            </Field>
            <Field label="Usuario" hint="como aparece en la red, sin @">
              <Input
                value={accountForm.handle}
                placeholder="mimarca"
                onChange={(event) => setAccountForm({ ...accountForm, handle: event.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Button
              variant="secondary"
              disabled={busy || accountForm.handle.trim().length < 2}
              onClick={addAccount}
            >
              Agregar cuenta
            </Button>
          </div>

          {accounts.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-zinc-600">
              {accounts.map((account, index) => (
                <li key={`${account.platform}-${index}`}>
                  ✓ {account.platform} · {account.handle}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
            <Button onClick={() => setStep(3)}>Siguiente</Button>
            {accounts.length === 0 && (
              <Button variant="ghost" onClick={() => setStep(3)}>
                Saltear por ahora
              </Button>
            )}
          </div>
        </Card>
      )}

      {step === 3 && created && (
        <Card>
          <SectionTitle hint="con plazo, para poder decirte si vas a llegar">
            Paso 3 · Qué querés lograr
          </SectionTitle>
          <p className="mb-3 text-sm text-zinc-600">
            Un objetivo medible con plazo es lo que habilita «¿vas a llegar?»: el harness compara tu
            ritmo real contra la meta. Sin objetivo, esa parte de Métricas no tiene con qué comparar.
            También podés saltearlo.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Qué medís">
              <Select
                value={objective.metric}
                onChange={(event) => setObjective({ ...objective, metric: event.target.value })}
              >
                {METRIC_OPTIONS.map((metric) => (
                  <option key={metric} value={metric}>
                    {OBJECTIVE_METRIC_LABEL[metric] ?? metric}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Meta"
              hint={objective.metric === "ENGAGEMENT_RATE" ? "en % (ej. 4)" : objective.metric === "POSTS_PER_WEEK" ? "por semana" : "en número"}
            >
              <Input
                value={objective.target}
                inputMode="numeric"
                onChange={(event) => setObjective({ ...objective, target: event.target.value })}
              />
            </Field>
            <Field label="En cuántos días" hint="90 es un plazo razonable para arrancar">
              <Input
                value={objective.days}
                inputMode="numeric"
                onChange={(event) => setObjective({ ...objective, days: event.target.value })}
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
            <Button disabled={busy} onClick={addObjective}>
              Guardar objetivo y terminar
            </Button>
            <Button variant="ghost" onClick={() => setStep(4)}>
              Saltear
            </Button>
          </div>
        </Card>
      )}

      {step === 4 && created && (
        <Card>
          <SectionTitle hint="ya podés usar el harness">Listo: tu perfil está creado</SectionTitle>
          <p className="mb-2 text-sm text-zinc-600">
            <strong>{created.name}</strong> quedó como perfil activo
            {accounts.length > 0 ? `, con ${accounts.length} cuenta(s)` : " (todavía sin cuentas)"}
            {objectives.length > 0 ? ` y ${objectives.length} objetivo(s)` : " (todavía sin objetivos)"}.
            Las pestañas ya están disponibles: abajo tenés qué sigue, en orden.
          </p>
          <div className="mt-3">
            <GoButton href="/social">Ir a mi resumen</GoButton>
          </div>
        </Card>
      )}

      {step === 4 && created && <SetupChecklist profileId={created.id} />}

      <p className="mt-4 text-center text-xs text-zinc-400">
        ¿Ya tenías un perfil?{" "}
        <button className="underline" onClick={() => router.push("/social")}>
          Ir al resumen
        </button>
      </p>
    </div>
  );
}
