import { api, type components } from "@tea-pos/api-client";
import { useInfiniteList } from "@tea-pos/api-client/list";
import { STALE } from "@tea-pos/api-client/query";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSlug } from "@tea-pos/shell/tenant";
import { Avatar } from "@tea-pos/ui/Avatar";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { LoadMore } from "@tea-pos/ui/LoadMore";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { channelName, KIND_ICON, listTime } from "./labels";

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
    const text = a.deleted ? t("chat.deleted") : a.body || a.event || t("chat.photo");
    return (
        <ListRow
            top
            leading={
                system ? (
                    <span className="flex size-10 items-center justify-center rounded-full bg-slate-100">
                        <Bell size={20} className="text-gray-900" />
                    </span>
                ) : (
                    <Avatar url={a.avatar} size={40} />
                )
            }
            // As Slack's: who, the time; where it was (and if it answered me); what they said.
            title={
                <span className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5">
                    <span
                        className={`truncate text-gray-900 ${a.unread ? "font-semibold" : "font-medium"}`}
                    >
                        {system ? where : a.author}
                    </span>
                    <span className="flex items-center justify-end gap-1.5 text-sm font-normal text-gray-600 tabular-nums">
                        {listTime(a.at, locale)}
                        {a.unread && <span className="size-2 rounded-full bg-brand" />}
                    </span>
                    <span className="col-span-2 flex min-w-0 items-center gap-1 text-[13px] font-medium text-gray-600">
                        <Icon size={13} className="shrink-0" />
                        <span className="truncate">{where}</span>
                        {a.toMe && (
                            <span className="shrink-0 font-semibold text-brand">
                                · {t("chat.activityReply")}
                            </span>
                        )}
                    </span>
                    <span
                        className={`col-span-2 line-clamp-2 text-sm font-normal ${a.unread ? "text-gray-900" : "text-gray-600"}`}
                    >
                        {text}
                    </span>
                </span>
            }
            onClick={() =>
                // Each app types its own routes' search; chat is shared by both.
                void navigate({ to: `/${slug}/chats/${a.channelId}`, search: { m: a.id } as never })
            }
            trailing={false}
        />
    );
}
