export type ConversationListItem = {
  id: string;
  channel: string;
  customerIdentifier: string;
  customerName: string | null;
  status: string;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  lastMessageRole: string | null;
};

export type ConversationListResponse = {
  data: ConversationListItem[];
  total: number;
  limit: number;
  offset: number;
};

export const CONVERSATION_STATUSES = [
  { value: "ACTIVE", label: "Activa" },
  { value: "ESCALATED", label: "Escalada" },
  { value: "RESOLVED", label: "Resuelta" },
  { value: "ABANDONED", label: "Abandonada" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  ESCALATED: "Escalada",
  RESOLVED: "Resuelta",
  ABANDONED: "Abandonada",
};

const STATUS_BADGES: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ESCALATED: "bg-amber-100 text-amber-700",
  RESOLVED: "bg-zinc-100 text-zinc-600",
  ABANDONED: "bg-zinc-100 text-zinc-500",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusBadgeClass(status: string): string {
  return STATUS_BADGES[status] ?? "bg-zinc-100 text-zinc-600";
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}
