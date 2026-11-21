import {
    pushState,
    turnPushOn,
    type PushState,
    useChatChannels,
    type ChatChannel,
} from "@tea-pos/api-client/chat";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { useSearchParam, useSearchText } from "@tea-pos/shell/searchParam";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { Segmented } from "@tea-pos/ui/form/Segmented";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { SearchBox } from "@tea-pos/ui/SearchBox";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Lock, MessagesSquare, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { ActivityList, useActivityUnread } from "./ActivityList";
import { channelName, KIND_ICON, listTime } from "./labels";
import { useTyping } from "./typing";

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
    const hasChat = !!useTenant()?.tenant.access.chat;
    const [view, setView] = useSearchParam("view");
    const [search, setSearch] = useSearchText();
    const slug = useSlug();
    const activity = useActivityUnread(hasChat ? slug : "").data ?? 0;
    if (!hasChat) return <NoAccess />;
    return (
        <div className="space-y-3">
            <SearchBox
                value={search}
                onChange={setSearch}
                placeholder={t("chat.search")}
                clearLabel={t("common.close")}
            />
            <Segmented
                size="lg"
                value={view === "activity" ? "activity" : "messages"}
                onChange={(v) => setView(v === "activity" ? v : "")}
                choices={[
                    { value: "messages", label: t("chat.messages") },
                    {
                        value: "activity",
                        label:
                            activity > 0
                                ? `${t("chat.activity")} (${activity > 99 ? "99+" : activity})`
                                : t("chat.activity"),
                    },
                ]}
            />
            {view === "activity" ? (
                <ActivityList />
            ) : (
                <Channels search={search.trim().toLowerCase()} />
            )}
        </div>
    );
}

/** Messages: every channel but Notifications, which belongs to Activity. */
function Channels({ search }: { search: string }) {
    const t = useT();
    const slug = useSlug();
    const { data } = useChatChannels(slug, true);
    if (!data)
        return (
            <ListCard>
                {[0, 1, 2].map((i) => (
                    <ListRowSkeleton key={i} withLeading />
                ))}
            </ListCard>
        );
    const channels = data.channels
        .filter((c) => c.kind !== "personal")
        .filter((c) => !search || channelName(c, t).toLowerCase().includes(search));
    if (channels.length === 0)
        return search ? (
            <EmptyState title={t("chat.noMatch")} icon={Search} className="py-16" />
        ) : (
            <EmptyState title={t("chat.noChats")} icon={MessagesSquare} />
        );
    return (
        <>
            <ListCard>
                {channels.map((c) => (
                    <ChannelRow key={c.id} channel={c} />
                ))}
            </ListCard>
            <PushCard />
        </>
    );
}

/**
 * Notifications, where chat is (owner): while this phone does not get them, a card under the
 * chats asks once with a tap (phones allow the question only then). No off switch in the app:
 * that is the phone's settings, so nobody turns them off by accident.
 */
function PushCard() {
    const t = useT();
    const [state, setState] = useState<PushState | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        void pushState().then(setState);
    }, []);
    if (state !== "off" && state !== "blocked") return null;
    return (
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-white p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Bell size={20} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-gray-900">
                    {t("chat.pushTitle")}
                </span>
                <span className="block text-sm text-gray-600">
                    {t(state === "blocked" ? "chat.pushBlocked" : "chat.pushBody")}
                </span>
                {state === "off" && (
                    <button
                        disabled={busy}
                        onClick={() => {
                            setBusy(true);
                            void turnPushOn()
                                .catch(() => {})
                                .then(pushState)
                                .then(setState)
                                .finally(() => setBusy(false));
                        }}
                        className="mt-3 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white active:opacity-80 disabled:opacity-50"
                    >
                        {t("chat.pushTurnOn")}
                    </button>
                )}
            </span>
        </div>
    );
}

function ChannelRow({ channel: c }: { channel: ChatChannel }) {
    const t = useT();
    const slug = useSlug();
    const navigate = useNavigate();
    const Icon = KIND_ICON[c.kind];
    const typing = useTyping(c.id).length > 0;
    const locale = useLocale();
    return (
        <ListRow
            top
            leading={
                <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100">
                    <Icon size={20} className="text-gray-900" />
                </span>
            }
            // One grid: the name and the time on one line, the message and the count on the next.
            title={
                <span className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5">
                    <span
                        className={`truncate text-gray-900 ${c.unread ? "font-semibold" : "font-medium"}`}
                    >
                        {channelName(c, t)}
                    </span>
                    {/* Top right: how many are unread, not the time (a group is opened, not scanned). */}
                    <span className="flex h-5 justify-end">
                        {c.unread > 0 && (
                            <span className="min-w-7 h-5 px-2 rounded-full bg-brand text-white text-xs font-bold leading-5 text-center">
                                {c.unread > 99 ? "99+" : c.unread}
                            </span>
                        )}
                    </span>
                    {/* A group chat: who is in it, not its last message (that is the chat's or Activity's). */}
                    <span
                        className={`truncate text-sm font-normal ${typing ? "text-brand" : "text-gray-600"}`}
                    >
                        {typing
                            ? t("chat.typing")
                            : [
                                  t(
                                      c.members === 1 ? "chat.oneMember" : "chat.memberCount",
                                  ).replace("{n}", String(c.members ?? 0)),
                                  // When it was last active, beside who is in it.
                                  ...(c.lastAt ? [listTime(c.lastAt, locale)] : []),
                              ].join(" · ")}
                    </span>
                    <span />
                </span>
            }
            onClick={() => void navigate({ to: `/${slug}/chats/${c.id}` })}
            trailing={false}
        />
    );
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
