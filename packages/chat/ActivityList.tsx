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

import { channelName, listTime } from "./labels";

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
 * Activity, as Slack's (task 068c): everything about me across every channel, newest first,
 * without opening them: replies to my messages and my Notifications. A tap opens the channel
 * at that message.
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
    const inbox = a.channelKind === "personal";
    const where = channelName({ kind: a.channelKind, name: a.channelName }, t);
    const title = inbox ? where : `${a.author ?? ""} ${t("chat.activityReply")}`;
    const text = a.body || a.event || t("chat.photo");
    return (
        <ListRow
            top
            leading={
                inbox ? (
                    <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100">
                        <Bell size={20} className="text-gray-900" />
                    </span>
                ) : (
                    <Avatar url={a.avatar} size={40} />
                )
            }
            title={
                <span className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5">
                    <span
                        className={`truncate text-gray-900 ${a.unread ? "font-semibold" : "font-medium"}`}
                    >
                        {title}
                    </span>
                    <span className="text-right text-sm font-normal text-gray-600 tabular-nums">
                        {listTime(a.at, locale)}
                    </span>
                    <span
                        className={`line-clamp-2 text-sm font-normal ${a.unread ? "text-gray-900" : "text-gray-600"}`}
                    >
                        {!inbox && (
                            <span className="font-medium text-brand">
                                {t("chat.activityIn").replace("{name}", where)} ·{" "}
                            </span>
                        )}
                        {text}
                    </span>
                    <span className="flex h-5 justify-end">
                        {a.unread && <span className="mt-1.5 size-2.5 rounded-full bg-brand" />}
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
