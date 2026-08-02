export type Channel = "whatsapp" | "instagram" | "messenger" | "web_chat" | "telegram";

export type ChannelBadge = {
  label: string;
  className: string;
};

const CHANNEL_BADGES: Record<Channel, ChannelBadge> = {
  whatsapp: {
    label: "WhatsApp",
    className: "bg-green-100 text-green-700",
  },
  instagram: {
    label: "Instagram",
    className: "bg-pink-100 text-pink-700",
  },
  messenger: {
    label: "Messenger",
    className: "bg-blue-100 text-blue-700",
  },
  web_chat: {
    label: "Web Chat",
    className: "bg-purple-100 text-purple-700",
  },
  telegram: {
    label: "Telegram",
    className: "bg-sky-100 text-sky-700",
  },
};

export function channelBadge(channel: string): ChannelBadge {
  return CHANNEL_BADGES[channel as Channel] ?? { label: channel, className: "bg-zinc-100 text-zinc-600" };
}
