import { useChatChannels, type ChatChannel } from "@tea-pos/api-client/chat";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { useNavigate } from "@tanstack/react-router";
import { Lock, MessagesSquare } from "lucide-react";

import { channelName, KIND_ICON, listTime } from "./labels";

/** The Chats tab: the caller's channels, the newest message first (RFC: Chat (v2), screen 1). */
export default function ChatsScreen() {
    return (
        <div className="chat min-h-full">
            <Chats />
        </div>
    );
}

function Chats() {
    const t = useT();
    const slug = useSlug();
    const hasChat = !!useTenant()?.tenant.access.chat;
    const { data } = useChatChannels(slug, hasChat);
    if (!hasChat) return <NoAccess />;
    if (!data)
        return (
            <ListCard>
                {[0, 1, 2].map((i) => (
                    <ListRowSkeleton key={i} withLeading />
                ))}
            </ListCard>
        );
    if (data.channels.length === 0)
        return <EmptyState title={t("chat.noChats")} icon={MessagesSquare} />;
    return (
        <ListCard>
            {data.channels.map((c) => (
                <ChannelRow key={c.id} channel={c} />
            ))}
        </ListCard>
    );
}

function ChannelRow({ channel: c }: { channel: ChatChannel }) {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const navigate = useNavigate();
    const Icon = KIND_ICON[c.kind];
    return (
        <ListRow
            top
            leading={
                <span className="flex size-10 items-center justify-center">
                    <Icon size={20} className="text-gray-900" />
                </span>
            }
            title={
                <span className={c.unread ? "font-semibold" : undefined}>{channelName(c, t)}</span>
            }
            subtitle={preview(c, t)}
            onClick={() => void navigate({ to: `/${slug}/chats/${c.id}` })}
            trailing={
                <span className="flex shrink-0 flex-col items-end gap-1">
                    {c.lastAt && (
                        <span className="text-xs text-gray-500">{listTime(c.lastAt, locale)}</span>
                    )}
                    {c.unread > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand text-white text-xs font-bold leading-5 text-center">
                            {c.unread > 99 ? "99+" : c.unread}
                        </span>
                    )}
                </span>
            }
        />
    );
}

/** The last message on one line: who, then what. */
function preview(c: ChatChannel, t: ReturnType<typeof useT>): string | undefined {
    const last = c.last;
    if (!last) return t("chat.noMessages");
    const what = last.deleted ? t("chat.deleted") : last.body || t("chat.photo");
    if (last.event) return what;
    return `${last.mine ? t("chat.you") : last.author}: ${what}`;
}

/** Someone on chat None who reached the address anyway; the tab itself is hidden for them. */
function NoAccess() {
    const t = useT();
    return (
        <EmptyState
            title={t("chat.noAccess")}
            body={t("chat.noAccessSub")}
            icon={Lock}
            className="min-h-full py-24"
        />
    );
}
