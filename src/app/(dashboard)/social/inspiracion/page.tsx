"use client";

import { useState } from "react";
import { socialApi } from "@/lib/social-api";
import type { Profile, SignalListResponse } from "@/lib/social-types";
import { platformList } from "@/lib/social-types";
import {
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  Input,
  Loading,
  ProfilePicker,
  Score,
  SectionTitle,
  Select,
  Textarea,
  fmtDateTime,
  useActiveProfile,
} from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/**
 * Pegar inspiración: el camino manual para lo que no se puede automatizar (una idea
 * propia, algo que vio en la calle, un link de LinkedIn — que no se scrapea).
 *
 * Entra al MISMO pipeline que lo recolectado: se analiza y puede convertirse en idea.
 */
export default function SocialInspiration() {
  const { data: profiles } = usePoll<Profile[]>(() => socialApi.get("/profiles"), 60000);
  const { profileId, select } = useActiveProfile(profiles ?? []);
  const { data: platformsData } = usePoll<unknown>(() => socialApi.get("/platforms"), 300000);
  // `GET /platforms` devuelve `{ platforms: [...] }`: se normaliza una sola vez acá.
  const platforms = platformList(platformsData);

  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: pasted, reload } = usePoll<SignalListResponse>(
    () =>
      profileId
        ? socialApi.get(`/signals?kind=INSPIRATION&profileId=${profileId}&limit=20`)
        : Promise.resolve({ total: 0, count: 0, signals: [] }),
    30000,
    [profileId],
  );

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const hasUrl = url.trim().length > 0;
      const body = {
        profileId,
        // La API pide un texto: si solo hay enlace, el texto es el enlace (el
        // fingerprint se calcula sobre la URL canónica).
        text: text.trim().length >= 20 ? text.trim() : hasUrl ? url.trim() : text.trim(),
        ...(hasUrl ? { url: url.trim() } : {}),
        ...(platform ? { platform } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      };

      if (body.text.length < 20) {
        throw new Error("Contá un poco más (mínimo 20 caracteres) o pegá el enlace.");
      }

      const result = await socialApi.post<{ created: boolean; signalId: string }>(
        hasUrl ? "/signals/from-url" : "/signals/from-text",
        body,
      );

      setMessage(
        result.created
          ? "Guardada. Se está analizando: en un momento aparece su relevancia."
          : "Ya la tenías pegada: se reasignó al perfil y se vuelve a analizar.",
      );
      setText("");
      setUrl("");
      setNote("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold">Pegar inspiración</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Un caso propio, una idea suelta o un enlace que no se puede recolectar. Entra al mismo
        pipeline: se analiza y puede terminar en una idea del calendario.
      </p>

      <div className="mt-4">
        <ProfilePicker profiles={profiles ?? []} value={profileId} onChange={select} />
      </div>

      <Card className="mt-2">
        <SectionTitle hint="mínimo 20 caracteres">Qué querés contarle al coach</SectionTitle>
        <div className="space-y-3">
          <Field label="Texto">
            <Textarea
              rows={5}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ej: automatizamos el soporte de una pyme con IA y pasamos de 4 horas diarias a 20 minutos de revisión…"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Enlace (opcional)" hint="Si lo pegás, se usa para deduplicar">
                <Input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://…"
                />
              </Field>
            </div>
            <Field label="Red (opcional)">
              <Select value={platform} onChange={(event) => setPlatform(event.target.value)}>
                <option value="">Sin red</option>
                {platforms.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Por qué te interesó (opcional)" hint="Entra al prompt del análisis tal cual">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej: es justo lo que hace mi equipo, quiero contarlo con números"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy || !profileId} onClick={submit}>
              {busy ? "Guardando…" : "Pegar y analizar"}
            </Button>
            {message && <span className="text-sm text-emerald-700">{message}</span>}
          </div>
          <ErrorBox message={error} />
        </div>
      </Card>

      <Card className="mt-4">
        <SectionTitle hint="lo que pegaste, con su relevancia">Tus inspiraciones</SectionTitle>
        {!pasted ? (
          <Loading />
        ) : pasted.signals.length === 0 ? (
          <Empty>Todavía no pegaste nada.</Empty>
        ) : (
          <ul className="space-y-2">
            {pasted.signals.map((signal) => (
              <li key={signal.id} className="border-b border-zinc-100 pb-2 last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-sm">{signal.title}</span>
                  <Score score={signal.relevance[0]?.score ?? 0} />
                </div>
                <div className="mt-1 text-xs text-zinc-500">{fmtDateTime(signal.createdAt)}</div>
                {(signal.relevance[0]?.reasons ?? []).length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-zinc-500">
                    {(signal.relevance[0]?.reasons ?? []).map((reason) => (
                      <li key={reason}>· {reason}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
