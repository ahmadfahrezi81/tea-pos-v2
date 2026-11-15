import { $api, api, type components } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

export type ChatMessage = components["schemas"]["ChatMessage"];

/** A channel, its members and how far each has read (Seen by): refetched when someone reads. */
export function useChannel(tenant: string, id: string) {
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/chat/channels/{id}",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant, staleTime: STALE.HOT, meta: { live: ["chat", "chat_read"] } },
    );
}

/** What the phone holds of a channel: oldest first, and where older history continues. */
export interface Thread {
    items: ChatMessage[];
    next?: string;
}

const PAGE = 30;
/** Held messages older than this are fetched again, so their signed photo addresses are new. */
const FRESH_MS = 60 * 60 * 1000;

export const threadKey = (tenant: string, id: string) => ["chat-messages", tenant, id] as const;

/** Adds messages to what is held, each once (a later copy replaces an earlier), in time order. */
export function merge(items: readonly ChatMessage[], more: readonly ChatMessage[]): ChatMessage[] {
    const byId = new Map(items.map((m) => [m.id, m]));
    for (const m of more) byId.set(m.id, m);
    return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

/**
 * A channel's messages. The first fetch takes the newest page; every later one (a live update,
 * coming back to it) asks only for what came after the newest held: a few hundred bytes.
 */
export function useThread(tenant: string, id: string) {
    const queryClient = useQueryClient();
    return useQuery({
        queryKey: threadKey(tenant, id),
        enabled: !!tenant,
        staleTime: STALE.HOT,
        meta: { live: ["chat"] },
        queryFn: async ({ signal }): Promise<Thread> => {
            const held = queryClient.getQueryData<Thread>(threadKey(tenant, id));
            const newest = held?.items.at(-1);
            // Photo addresses last 6 hours: older held pages start again from the newest page.
            const age =
                Date.now() - (queryClient.getQueryState(threadKey(tenant, id))?.dataUpdatedAt ?? 0);
            const fresh = age < FRESH_MS;
            const path = { tenant, id };
            if (held && newest && fresh) {
                const { data, error } = await api.GET(
                    "/tenants/{tenant}/chat/channels/{id}/messages",
                    {
                        params: { path, query: { since: newest.at } },
                        signal,
                    },
                );
                if (error) throw error;
                return { ...held, items: merge(held.items, data.items) };
            }
            const { data, error } = await api.GET("/tenants/{tenant}/chat/channels/{id}/messages", {
                params: { path, query: { limit: PAGE } },
                signal,
            });
            if (error) throw error;
            return { items: [...data.items].reverse(), next: data.next };
        },
    });
}

/** The page before the oldest held, put in front of it. */
export async function loadEarlier(queryClient: QueryClient, tenant: string, id: string) {
    const key = threadKey(tenant, id);
    const held = queryClient.getQueryData<Thread>(key);
    if (!held?.next) return;
    const { data, error } = await api.GET("/tenants/{tenant}/chat/channels/{id}/messages", {
        params: { path: { tenant, id }, query: { cursor: held.next, limit: PAGE } },
    });
    if (error) throw error;
    queryClient.setQueryData<Thread>(key, (now) => ({
        items: merge(now?.items ?? [], data.items),
        next: data.next,
    }));
}

/** A message the server saved, put where it belongs without asking again. */
export function hold(queryClient: QueryClient, tenant: string, id: string, m: ChatMessage) {
    queryClient.setQueryData<Thread>(threadKey(tenant, id), (now) => ({
        items: merge(now?.items ?? [], [m]),
        next: now?.next,
    }));
}
