"use client";

import Link from "next/link";
import { useState } from "react";
import { socialApi } from "@/lib/social-api";
import type { NotificationList } from "@/lib/social-types";
import { Badge, Button, Card, Empty, ErrorBox, Loading, SectionTitle, relative } from "@/lib/social-ui";
import { usePoll } from "@/lib/usePoll";

/** A dónde lleva cada tipo de aviso (la bandeja es la puerta de entrada al trabajo). */
const TYPE_TARGET: Record<string, string> = {
  IDEAS_READY: "/social/ideas",
  SIGNALS_READY: "/social/tendencias",
  COLLECTION_FAILED: "/social/fuentes",
  INFO: "/social/metricas",
};

const TYPE_LABEL: Record<string, string> = {
  IDEAS_READY: "Ideas listas",
  SIGNALS_READY: "Señales analizadas",
  COLLECTION_FAILED: "Falló una fuente",
  INFO: "Aviso",
};

export default function SocialNotifications() {
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, error: pollError, reload } = usePoll<NotificationList>(
    () => socialApi.get(`/notifications${onlyUnread ? "?unread=true" : ""}`),
    15000,
    [onlyUnread],
  );

  async function mark(id: string) {
    setBusy(true);
    setError(null);
    try {
      await socialApi.patch(`/notifications/${id}/read`, {});
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    setError(null);
    try {
      await socialApi.patch("/notifications/read-all", {});
      reload();
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
          <h1 className="text-xl font-bold">Avisos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Lo que hizo el harness mientras no estabas: señales analizadas, ideas listas y fuentes que
            fallaron.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setOnlyUnread((value) => !value)}>
            {onlyUnread ? "Ver todos" : "Solo sin leer"}
          </Button>
          <Button variant="secondary" disabled={busy || (data?.unread ?? 0) === 0} onClick={markAll}>
            Marcar todo como leído
          </Button>
        </div>
      </div>

      <ErrorBox message={error ?? pollError} />

      {!data ? (
        <Loading />
      ) : data.notifications.length === 0 ? (
        <Card className="mt-4">
          <Empty>{onlyUnread ? "Nada sin leer." : "Todavía no hay avisos."}</Empty>
        </Card>
      ) : (
        <div className="mt-4 space-y-2">
          {data.notifications.map((notification) => (
            <Card key={notification.id} className={notification.readAt ? "opacity-70" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        notification.type === "COLLECTION_FAILED"
                          ? "red"
                          : notification.type === "IDEAS_READY"
                            ? "emerald"
                            : "zinc"
                      }
                    >
                      {TYPE_LABEL[notification.type] ?? notification.type}
                    </Badge>
                    {notification.profile && <span className="text-xs text-zinc-500">{notification.profile.name}</span>}
                    <span className="text-xs text-zinc-400">{relative(notification.createdAt)}</span>
                    {!notification.readAt && <Badge tone="blue">nuevo</Badge>}
                  </div>
                  <div className="mt-1 text-sm font-medium">{notification.title}</div>
                  <p className="mt-1 text-sm text-zinc-600">{notification.body}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={TYPE_TARGET[notification.type] ?? "/social"}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    Ir
                  </Link>
                  {!notification.readAt && (
                    <Button variant="ghost" disabled={busy} onClick={() => mark(notification.id)}>
                      Marcar leído
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4">
        <SectionTitle hint="se actualiza solo cada 15 s"> </SectionTitle>
      </div>
    </div>
  );
}
