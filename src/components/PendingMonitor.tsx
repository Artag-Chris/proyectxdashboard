"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { isNotificationSupported, notify, playPing } from "@/lib/notifications";

export type PendingItem = {
  id: string;
  channel: string;
  customerIdentifier: string;
  customerName: string | null;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessageText: string;
};

export type PendingResponse = {
  data: PendingItem[];
  total: number;
};

export type InboundActivityItem = {
  id: string;
  conversationId: string;
  customerIdentifier: string;
  customerName: string | null;
  text: string;
  createdAt: string;
};

export type InboundActivityResponse = {
  data: InboundActivityItem[];
  latest: string;
};

const POLL_INTERVAL_MS = 10000;
const INITIAL_WINDOW_MS = 5 * 60 * 1000;

export function displayName(item: { customerName: string | null; customerIdentifier: string }) {
  return item.customerName ?? item.customerIdentifier;
}

export default function PendingMonitor({
  onTotalChange,
}: {
  onTotalChange: (total: number) => void;
}) {
  const cursorRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const enabledRef = useRef(false);

  const updateEnabled = () => {
    enabledRef.current = isNotificationSupported() && Notification.permission === "granted";
  };

  useEffect(() => {
    updateEnabled();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    async function poll() {
      updateEnabled();
      try {
        const pendingRes = await api.get<PendingResponse>("/api/dashboard/pending");
        if (cancelled) return;
        onTotalChange((pendingRes.data ?? []).reduce((acc, item) => acc + item.unreadCount, 0));
      } catch {
        // Poll fallido: se reintenta en el siguiente tick.
      }

      try {
        const since = cursorRef.current ?? new Date(Date.now() - INITIAL_WINDOW_MS).toISOString();
        const activityRes = await api.get<InboundActivityResponse>(
          `/api/dashboard/inbound-activity?since=${encodeURIComponent(since)}`,
        );
        if (cancelled) return;

        const items = activityRes.data ?? [];
        if (!initializedRef.current) {
          // Primer poll: snapshot del estado actual sin notificar, para no
          // bombardear al abrir la app.
          initializedRef.current = true;
        } else if (items.length > 0) {
          if (enabledRef.current) {
            let pinged = false;
            for (const item of items) {
              notify(`${displayName(item)} escribió`, item.text || "");
              if (!pinged) {
                playPing();
                pinged = true;
              }
            }
          }
        }

        if (items.length > 0) {
          cursorRef.current = activityRes.latest ?? items[items.length - 1].createdAt;
        }
      } catch {
        // Poll fallido: se reintenta en el siguiente tick.
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [onTotalChange]);

  return null;
}
