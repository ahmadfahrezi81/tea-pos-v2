import type { components } from "@tea-pos/api-client";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { Avatar } from "@tea-pos/ui/Avatar";
import { Badge } from "@tea-pos/ui/Badge";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { Sheet } from "@tea-pos/ui/Sheet";
import { useState } from "react";

import { channelName, KIND_ICON } from "./labels";

type Channel = components["schemas"]["ChatChannelOutputBody"];
type Member = Channel["members"][number];

const WHO: Record<Channel["kind"], MessageKey> = {
    general: "chat.whoGeneral",
    store: "chat.whoStore",
    group: "chat.whoGroup",
    admin: "chat.whoAdmin",
    personal: "chat.whoPersonal",
};

/** Me first, then by name. */
function sorted(members: Member[], me: string, locale: string): Member[] {
    return [...members].sort(
        (a, b) => +(b.id === me) - +(a.id === me) || a.name.localeCompare(b.name, locale),
    );
}

/** The channel in the header, as WhatsApp: its icon, its name, how many are in it; a tap opens its info. */
export function ChannelHeader({ channel, me }: { channel: Channel; me: string }) {
    const t = useT();
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const Icon = KIND_ICON[channel.kind];
    const members = sorted(channel.members, me, locale);
    const who =
        channel.kind === "personal"
            ? t("chat.whoPersonal")
            : members.length === 1
              ? t("chat.oneMember")
              : t("chat.memberCount").replace("{n}", String(members.length));
    return (
        <>
            <HeaderTitle onClick={() => setOpen(true)}>
                <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-200">
                        <Icon size={18} className="text-gray-900" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-bold leading-tight">
                            {channelName(channel, t)}
                        </span>
                        <span className="block truncate text-xs font-normal tracking-normal text-gray-500">
                            {who}
                        </span>
                    </span>
                </span>
            </HeaderTitle>
            {open && (
                <ChannelInfo
                    channel={channel}
                    members={members}
                    me={me}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
}

/** A channel's details (RFC screen 5, without settings: chat is the company's, nobody leaves). */
function ChannelInfo({
    channel,
    members,
    me,
    onClose,
}: {
    channel: Channel;
    members: Member[];
    me: string;
    onClose: () => void;
}) {
    const t = useT();
    const Icon = KIND_ICON[channel.kind];
    return (
        <Sheet open onClose={onClose} title={t("chat.info")}>
            <div className="chat space-y-5 pb-4">
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <span className="flex size-16 items-center justify-center rounded-2xl bg-slate-100">
                        <Icon size={28} className="text-gray-900" />
                    </span>
                    <p className="pt-1 text-xl font-bold text-gray-900">
                        {channelName(channel, t)}
                    </p>
                    <p className="text-sm text-gray-500">{t(WHO[channel.kind])}</p>
                </div>
                {channel.kind !== "personal" && (
                    <section className="space-y-1">
                        <SectionLabel>{`${t("chat.members")} (${members.length})`}</SectionLabel>
                        {members.map((m) => (
                            <div
                                key={m.id}
                                className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                            >
                                <Avatar url={m.avatar} size={32} />
                                <span className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="truncate text-[16px] text-gray-900">
                                        {m.id === me ? `${m.name} (${t("chat.you")})` : m.name}
                                    </span>
                                    {m.vip && (
                                        <Badge tone="brand" size="sm">
                                            {t("chat.vip")}
                                        </Badge>
                                    )}
                                </span>
                            </div>
                        ))}
                    </section>
                )}
            </div>
        </Sheet>
    );
}
