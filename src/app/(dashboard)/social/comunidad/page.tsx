"use client";

import { useState } from "react";
import { socialApi } from "@/lib/social-api";
import type { AudienceSegment, Profile } from "@/lib/social-types";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Input,
  Loading,
  ProfilePicker,
  SectionTitle,
  Textarea,
  useActiveProfile,
} from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Comunidad — audiencia.
 *
 * La audiencia estructurada es el objeto que comparten los dos coaches: el de comunidad la
 * produce y el de contenido la usa para escribir ideas y borradores que le hablen a alguien
 * concreto. Acá se propone, se corrige y se archiva.
 *
 * El badge de origen no es decorativo: `Plantilla` significa que no hubo IA (y hay que
 * completarlo a mano), `IA` que lo propuso el modelo y `Tuyo` que lo tocaste vos — y esos
 * no se archivan solos en la próxima propuesta.
 */

const SOURCE_LABEL: Record<string, string> = {
  ia: "Propuesto por IA",
  plantilla: "Plantilla (sin IA)",
  manual: "Tuyo",
};

const SOURCE_TONE: Record<string, "zinc" | "emerald" | "amber" | "red" | "blue" | "violet"> = {
  ia: "violet",
  plantilla: "amber",
  manual: "emerald",
};

export default function SocialCommunity() {
  const { data: profiles, reload: reloadProfiles } = usePoll<Profile[]>(() => socialApi.get("/profiles"), 60000);
  const { profileId, select } = useActiveProfile(profiles ?? []);
  const [showArchived, setShowArchived] = useState(false);

  const { data: segments, reload: reloadSegments } = usePoll<AudienceSegment[]>(
    () =>
      profileId
        ? socialApi.get(`/profiles/${profileId}/audience${showArchived ? "?includeArchived=true" : ""}`)
        : Promise.resolve([]),
    30000,
    [profileId, showArchived],
  );

  const [form, setForm] = useState({ name: "", description: "", pains: "", desires: "", objections: "", channels: "" });
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
      reloadSegments();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const activos = (segments ?? []).filter((segment) => segment.archivedAt === null);
  const archivados = (segments ?? []).filter((segment) => segment.archivedAt !== null);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Comunidad</h1>
          <p className="mt-1 text-sm text-zinc-500">
            A quién le hablás, en concreto. Esta audiencia alimenta las ideas, los borradores y el
            reporte: sin segmentos, todo eso le habla a «la audiencia» en general.
          </p>
        </div>
        <Button
          disabled={busy || !profileId}
          onClick={() =>
            run(
              "propose",
              () => socialApi.post(`/profiles/${profileId}/audience/propose`),
              "Propuesta encolada. Tarda unos segundos (una llamada de IA); después recargá.",
            )
          }
        >
          Proponer con IA
        </Button>
      </div>

      <div className="mt-4">
        <ProfilePicker profiles={profiles ?? []} value={profileId} onChange={select} />
      </div>

      <ErrorBox message={error} />
      {message && <p className="mt-2 text-sm text-emerald-700">{message}</p>}

      <Card className="mt-4">
        <SectionTitle hint="a quién le habla el perfil">Audiencia</SectionTitle>
        {!segments ? (
          <Loading />
        ) : activos.length === 0 ? (
          <Empty>
            Sin segmentos. Dale a «Proponer con IA» (sale de tu nicho y de lo que publicaste) o
            agregá uno a mano abajo.
          </Empty>
        ) : (
          <div className="space-y-4">
            {activos.map((segment) => (
              <div key={segment.id} className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-zinc-800">{segment.name}</span>
                  <Badge tone={SOURCE_TONE[segment.source] ?? "zinc"}>
                    {SOURCE_LABEL[segment.source] ?? segment.source}
                  </Badge>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      run(
                        "archive",
                        () => socialApi.patch(`/profiles/${profileId}/audience/${segment.id}`, { archived: true }),
                        "Segmento archivado (deja de entrar en los prompts).",
                      )
                    }
                  >
                    Archivar
                  </Button>
                </div>
                <p className="mt-1 text-sm text-zinc-600">{segment.description}</p>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <List title="Le duele" items={segment.pains} tone="text-red-700" />
                  <List title="Quiere" items={segment.desires} tone="text-emerald-700" />
                  <List title="No te sigue porque" items={segment.objections} tone="text-amber-700" />
                  <List title="Dónde está" items={segment.channels} tone="text-blue-700" />
                </div>

                {segment.languageTips && (
                  <p className="mt-2 text-xs text-zinc-500">Cómo le habla: {segment.languageTips}</p>
                )}
                {segment.evidence.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-400">Basado en: {segment.evidence.join(" · ")}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {archivados.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              className="text-xs text-zinc-500 underline"
              onClick={() => setShowArchived((value) => !value)}
            >
              {showArchived ? "Ocultar archivados" : `Ver archivados (${archivados.length})`}
            </button>
            {showArchived && (
              <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                {archivados.map((segment) => (
                  <li key={segment.id} className="flex items-center gap-2">
                    <span className="line-through">{segment.name}</span>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        run(
                          "restore",
                          () => socialApi.patch(`/profiles/${profileId}/audience/${segment.id}`, { archived: false }),
                          "Segmento reactivado.",
                        )
                      }
                    >
                      Reactivar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <SectionTitle hint="una idea por línea; lo que escribas queda como tuyo y no se archiva solo">
          Agregar un segmento a mano
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Quién es" hint="en 2 o 3 frases">
            <Input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <Field label="Le duele">
            <Textarea rows={3} value={form.pains} onChange={(event) => setForm({ ...form, pains: event.target.value })} />
          </Field>
          <Field label="Quiere">
            <Textarea
              rows={3}
              value={form.desires}
              onChange={(event) => setForm({ ...form, desires: event.target.value })}
            />
          </Field>
          <Field label="No te sigue porque">
            <Textarea
              rows={3}
              value={form.objections}
              onChange={(event) => setForm({ ...form, objections: event.target.value })}
            />
          </Field>
          <Field label="Dónde está" hint="subreddits, grupos, hashtags, canales">
            <Textarea
              rows={3}
              value={form.channels}
              onChange={(event) => setForm({ ...form, channels: event.target.value })}
            />
          </Field>
        </div>
        <div className="mt-2">
          <Button
            variant="secondary"
            disabled={busy || !profileId || form.name.trim().length < 3 || form.description.trim().length < 10}
            onClick={() =>
              run(
                "create",
                () =>
                  socialApi.post(`/profiles/${profileId}/audience`, {
                    name: form.name.trim(),
                    description: form.description.trim(),
                    pains: lines(form.pains),
                    desires: lines(form.desires),
                    objections: lines(form.objections),
                    channels: lines(form.channels),
                  }),
                "Segmento guardado.",
              ).then(() =>
                setForm({ name: "", description: "", pains: "", desires: "", objections: "", channels: "" }),
              )
            }
          >
            Guardar segmento
          </Button>
        </div>
      </Card>

      <p className="mt-4 text-xs text-zinc-400">
        Las comunidades donde participar y el plan de cada día llegan en la próxima etapa: la
        audiencia es la base que los hace posibles.
      </p>
      <div className="mt-2">
        <Button variant="secondary" onClick={reloadProfiles}>
          Refrescar
        </Button>
      </div>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`text-xs font-medium ${tone}`}>{title}</div>
      <ul className="text-sm text-zinc-600">
        {items.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Un textarea, una idea por línea. */
function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
