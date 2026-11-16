import type { ChatChannel } from "@tea-pos/api-client/chat";
import { formatDate, formatTime, localDate } from "@tea-pos/format";
import type { Locale, MessageKey } from "@tea-pos/i18n";
import { Bell, Globe, Hash, ShieldCheck, Users, type LucideIcon } from "lucide-react";

type Kind = ChatChannel["kind"];

/** A channel's name: a store's or a group's own, else the kind's, in the reader's language. */
export function channelName(c: { kind: Kind; name?: string }, t: (key: MessageKey) => string) {
    if (c.name) return c.name;
    const key: Partial<Record<Kind, MessageKey>> = {
        general: "chat.general",
        admin: "chat.admin",
        personal: "chat.personal",
    };
    return key[c.kind] ? t(key[c.kind]!) : "";
}

export const KIND_ICON: Record<Kind, LucideIcon> = {
    general: Globe,
    store: Hash,
    group: Users,
    admin: ShieldCheck,
    personal: Bell,
};

/** A message's time on a list: the time today, else the day. */
export function listTime(at: string, locale: Locale): string {
    return localDate(at) === localDate() ? formatTime(at, locale) : formatDate(at, locale);
}
