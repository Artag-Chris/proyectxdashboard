"use client";

import Link from "next/link";
import { cvApi } from "@/lib/cv-api";
import { usePoll } from "@/lib/usePoll";
import type { NotificationRow } from "@/lib/cv-types";

function typeBorder(type: string): string {
  switch (type) {
    case "RESUME_READY":
      return "border-green-200 bg-green-50";
    case "MATCH_READY":
      return "border-amber-200 bg-amber-50";
    case "SCRAPE_ERROR":
    case "SOURCE_ERROR":
      return "border-red-200 bg-red-50";
    default:
      return "border-zinc-200 bg-white";
  }
}

export default function CvNotificaciones() {
  const { data, reload } = usePoll<NotificationRow[]>(
    () => cvApi.get("/notifications?limit=100"),
    8000,
  );

  async function markRead(id: string) {
    await cvApi.post(`/notifications/${id}/read`);
    reload();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Notificaciones</h1>
        <span className="text-xs text-zinc-500">Se actualizan cada 8 s</span>
      </div>
      <div className="flex flex-col gap-2">
        {(data ?? []).map((n) => (
          <div
            key={n.id}
            className={`flex flex-wrap items-start gap-2 rounded-xl border p-3 shadow-sm ${
              typeBorder(n.type)
            } ${n.readAt ? "opacity-60" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold break-words">{n.title}</div>
              <div className="mt-0.5 text-sm text-zinc-600 break-words">{n.body}</div>
              <div className="mt-1 text-xs text-zinc-400">
                {new Date(n.createdAt).toLocaleString("es-CO")}
              </div>
            </div>
            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
              {n.payload.vacancyId && (
                <Link
                  href={`/cv/vacantes/${n.payload.vacancyId}`}
                  className="flex-1 rounded-lg bg-zinc-900 px-3 py-2.5 text-center text-xs font-semibold text-white hover:bg-zinc-700 sm:flex-none sm:py-1.5"
                >
                  Ver
                </Link>
              )}
              {!n.readAt && (
                <button
                  onClick={() => void markRead(n.id)}
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-xs text-zinc-500 hover:bg-white sm:flex-none sm:py-1.5"
                >
                  Marcar leída
                </button>
              )}
            </div>
          </div>
        ))}
        {data && data.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
            Sin notificaciones. Cuando haya un match alto vas a ver el borrador de HV acá.
          </p>
        )}
      </div>
    </div>
  );
}
