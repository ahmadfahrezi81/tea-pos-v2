import { api, type components } from "@tea-pos/api-client";
import { useInfiniteList } from "@tea-pos/api-client/list";
import { STALE } from "@tea-pos/api-client/query";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSlug } from "@tea-pos/shell/tenant";
import { Avatar } from "@tea-pos/ui/Avatar";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ListCard, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { LoadMore } from "@tea-pos/ui/LoadMore";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { eventText } from "./events";
import { BotBadge, SystemFace } from "./SystemFace";
import { channelName, KIND_ICON, listTime } from "./labels";
import { linkLabel } from "./links";

type Activity = components["schemas"]["ChatActivity"];

/** How many of Activity's are unread, for the switch: one small ask, refreshed with chat's changes. */
export function useActivityUnread(tenant: string) {
    return useQuery({
        queryKey: ["chat-activity-unread", tenant],
        enabled: !!tenant,
        staleTime: STALE.QUICK,
        meta: { live: ["chat", "chat_read"] },
        queryFn: async ({ signal }) => {
            const { data, error } = await api.GET("/tenants/{tenant}/chat/activity", {
                params: { path: { tenant }, query: { limit: 1 } },
                signal,
            });
            if (error) throw error;
            return data.unread;
        },
    });
}

/**
 * Activity, as Slack's (task 068c): every message from someone else across my channels, newest
 * first, without opening them; a reply to me is marked. A tap opens the channel at that message.
 */
export function ActivityList() {
    const t = useT();
    const slug = useSlug();
    const list = useInfiniteList<Activity>(
        ["chat-activity", slug],
        async (cursor) => {
            const { data, error } = await api.GET("/tenants/{tenant}/chat/activity", {
                params: { path: { tenant: slug }, query: { cursor: cursor || undefined } },
            });
            if (error) throw error;
            return { items: data.items ?? [], next: data.next };
        },
        ["chat", "chat_read"],
    );
    if (!list.data)
        return (
            <ListCard>
                {[0, 1, 2].map((i) => (
                    <ListRowSkeleton key={i} withLeading />
                ))}
            </ListCard>
        );
    if (list.data.length === 0)
        return (
            <EmptyState
                title={t("chat.noActivity")}
                body={t("chat.noActivitySub")}
                icon={Bell}
                className="py-16"
            />
        );
    return (
        <>
            <ListCard>
                {list.data.map((a) => (
                    <ActivityRow key={a.id} a={a} />
                ))}
            </ListCard>
            <LoadMore
                hasMore={!!list.hasNextPage}
                loading={list.isFetchingNextPage}
                onMore={() => void list.fetchNextPage()}
                label={t("chat.earlier")}
            />
        </>
    );
}

function ActivityRow({ a }: { a: Activity }) {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const navigate = useNavigate();
    const system = !a.authorId;
    const Icon = KIND_ICON[a.channelKind];
    const where = channelName({ kind: a.channelKind, name: a.channelName }, t);
    const text = a.deleted
        ? t("chat.deleted")
        : a.event
          ? eventText(a, t, locale)
          : a.body || (a.link ? t(linkLabel(a.link.kind)) : t("chat.photo"));
    return (
        // As Slack's: the person with where it came from in the photo's corner; where it was
        // posted; the message at the size it has in its chat.
        <button
            onClick={() =>
                // Each app types its own routes' search; chat is shared by both.
                void navigate({ to: `/${slug}/chats/${a.channelId}`, search: { m: a.id } as never })
            }
            className="group flex w-full items-start gap-3 text-left active:opacity-70"
        >
            <span className="relative mt-3 shrink-0">
                {system ? <SystemFace size={36} /> : <Avatar url={a.avatar} size={36} />}
                <span className="absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full bg-white ring-2 ring-white">
                    <Icon size={12} strokeWidth={2.5} className="text-gray-900" />
                </span>
            </span>
            <span className="min-w-0 flex-1 border-b-2 border-slate-100 py-3 group-last:border-b-0">
                <span className="flex items-center gap-2">
                    <span
                        className={`min-w-0 flex-1 truncate text-[14px] leading-5 text-gray-900 ${a.unread ? "font-bold" : "font-semibold"}`}
                    >
                        {system ? (
                            <span className="inline-flex items-center gap-1.5">
                                {t("chat.system")}
                                <BotBadge />
                            </span>
                        ) : (
                            a.author
                        )}
                    </span>
                    <span className="shrink-0 text-[12px] leading-4 text-gray-600 tabular-nums">
                        {listTime(a.at, locale)}
                    </span>
                    {a.unread && <span className="size-2 shrink-0 rounded-full bg-brand" />}
                </span>
                <span className="flex min-w-0 items-center gap-1 text-[12px] leading-4 text-gray-600">
                    <span className="shrink-0">
                        {t(
                            a.mentionsMe
                                ? "chat.activityMentioned"
                                : a.toMe
                                  ? "chat.activityReplied"
                                  : "chat.activityPosted",
                        )}
                    </span>
                    <Icon size={12} strokeWidth={2.5} className="shrink-0" />
                    <span className="truncate font-medium">{where}</span>
                </span>
                <span className="mt-0.5 flex items-start gap-3">
                    <span className="min-w-0 flex-1 line-clamp-3 text-[15px] leading-5 text-gray-900 whitespace-pre-wrap break-words">
                        {a.body || !a.photos?.length ? text : t("chat.photo")}
                    </span>
                    {/* A photo shows as itself, small, as the seller's activity log. */}
                    {!a.deleted && !!a.photos?.length && (
                        <img
                            src={a.photos[0]!.previewUrl || undefined}
                            alt=""
                            className="size-11 shrink-0 rounded-lg bg-slate-200 object-cover"
                        />
                    )}
                </span>
            </span>
        </button>
    );
}
