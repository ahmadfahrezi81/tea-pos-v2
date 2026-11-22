import {
    pushState,
    type PushState,
    useChatChannels,
    type ChatChannel,
} from "@tea-pos/api-client/chat";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useTurnPushOn } from "@tea-pos/shell/push";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { useSearchParam, useSearchText } from "@tea-pos/shell/searchParam";
import { Avatar } from "@tea-pos/ui/Avatar";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { Segmented } from "@tea-pos/ui/form/Segmented";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { SearchBox } from "@tea-pos/ui/SearchBox";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";
import { useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, Lock, MessagesSquare, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { ActivityList, useActivityUnread } from "./ActivityList";
import { NewGroupSheet, useChatAdmin, useFollow } from "./groups";
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

/**
 * Messages: every channel but Notifications, which belongs to Activity. A chat admin also sees
 * Other channels (RFC screen 1): not theirs, opened to read, followed to be told.
 */
function Channels({ search }: { search: string }) {
    const t = useT();
    const slug = useSlug();
    const admin = useChatAdmin();
    const [making, setMaking] = useState(false);
    const [showOther, setShowOther] = useState(false);
    const { data } = useChatChannels(slug, true);
    if (!data)
        return (
            <ListCard>
                {[0, 1, 2].map((i) => (
                    <ListRowSkeleton key={i} withLeading />
                ))}
            </ListCard>
        );
    const shown = data.channels
        .filter((c) => c.kind !== "personal")
        .filter((c) => !search || channelName(c, t).toLowerCase().includes(search));
    const mine = shown.filter((c) => c.mine);
    // Other channels: stores' first, then groups, by name.
    const other = shown
        .filter((c) => !c.mine)
        .sort(
            (a, b) =>
                a.kind.localeCompare(b.kind) * -1 ||
                channelName(a, t).localeCompare(channelName(b, t)),
        );
    if (shown.length === 0 && !admin)
        return search ? (
            <EmptyState title={t("chat.noMatch")} icon={Search} className="py-16" />
        ) : (
            <EmptyState title={t("chat.noChats")} icon={MessagesSquare} />
        );
    return (
        <>
            {mine.length > 0 && (
                <ListCard>
                    {mine.map((c) => (
                        <ChannelRow key={c.id} channel={c} />
                    ))}
                </ListCard>
            )}
            {admin && !search && (
                <button
                    type="button"
                    onClick={() => setMaking(true)}
                    className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left active:opacity-70"
                >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                        <Plus size={20} />
                    </span>
                    <span className="text-[16px] font-medium text-gray-900">
                        {t("chat.newGroup")}
                    </span>
                </button>
            )}
            {other.length > 0 && (
                <section className="mt-4 space-y-1.5">
                    {/* Folded away until asked for (a search shows its matches): every store is here. */}
                    <button
                        type="button"
                        onClick={() => setShowOther((o) => !o)}
                        className="flex w-full items-center justify-between pr-1 active:opacity-70"
                    >
                        <SectionLabel>
                            {t("chat.otherChannels")} · {other.length}
                        </SectionLabel>
                        <ChevronDown
                            size={18}
                            className={`text-gray-600 transition-transform ${showOther || search ? "rotate-180" : ""}`}
                        />
                    </button>
                    {(showOther || search) && (
                        <ListCard>
                            {other.map((c) => (
                                <ChannelRow key={c.id} channel={c} />
                            ))}
                        </ListCard>
                    )}
                </section>
            )}
            <PushCard />
            {admin && <NewGroupSheet open={making} onClose={() => setMaking(false)} />}
        </>
    );
}

/** Follow on an Other channel's row: its badge and pushes from now on. */
function FollowButton({ id }: { id: string }) {
    const t = useT();
    const follow = useFollow(id);
    return (
        <button
            type="button"
            disabled={follow.isPending}
            onClick={(e) => {
                e.stopPropagation();
                follow.mutate({ on: true });
            }}
            className="rounded-full bg-brand/10 px-3 py-0.5 text-[13px] leading-4 font-semibold text-brand active:opacity-70 disabled:opacity-50"
        >
            {t("chat.follow")}
        </button>
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
    const { turnOn, busy } = useTurnPushOn(setState);
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
                        onClick={() => void turnOn()}
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
                        className={`truncate text-gray-900 ${c.mine && c.unread ? "font-semibold" : "font-medium"}`}
                    >
                        {channelName(c, t)}
                    </span>
                    {/* Top right: how many are unread, not the time (a group is opened, not scanned). */}
                    <span className="flex h-5 justify-end">
                        {!c.mine ? (
                            <FollowButton id={c.id} />
                        ) : (
                            c.unread > 0 && (
                                <span className="min-w-7 h-5 px-2 rounded-full bg-brand text-white text-xs font-bold leading-5 text-center">
                                    {c.unread > 99 ? "99+" : c.unread}
                                </span>
                            )
                        )}
                    </span>
                    {/* A group chat: who is in it, not its last message (that is the chat's or Activity's). */}
                    <span
                        className={`flex min-w-0 items-center gap-1.5 text-sm font-normal ${typing ? "text-brand" : "text-gray-600"}`}
                    >
                        {/* Who wrote lately, overlapping (owner: as Slack's threads). */}
                        {!typing && !!c.faces?.length && (
                            <span className="flex shrink-0 -space-x-1.5">
                                {c.faces.map((f, i) => (
                                    <span key={i} className="rounded-[28.6%] ring-2 ring-white">
                                        <Avatar url={f.avatar} size={18} />
                                    </span>
                                ))}
                            </span>
                        )}
                        <span className="truncate">
                            {typing
                                ? t("chat.typing")
                                : [
                                      ...(c.archived ? [t("chat.archived")] : []),
                                      t(
                                          c.members === 1 ? "chat.oneMember" : "chat.memberCount",
                                      ).replace("{n}", String(c.members ?? 0)),
                                      // When it was last active, beside who is in it.
                                      ...(c.lastAt ? [listTime(c.lastAt, locale)] : []),
                                  ].join(" · ")}
                        </span>
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
