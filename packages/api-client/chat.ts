import { useEffect } from "react";

import { $api, type components } from "./index";
import { STALE } from "./query";

export type ChatChannel = components["schemas"]["ChatChannel"];

/**
 * The caller's chat channels (made by Go on the first ask). Light, so the shell reads it for the
 * Chats tab's count while the chat screens themselves load only when opened.
 */
export function useChatChannels(tenant: string, enabled = true) {
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/chat/channels",
        { params: { path: { tenant } } },
        { enabled: enabled && !!tenant, staleTime: STALE.QUICK, meta: { live: ["chat"] } },
    );
}

/** Unread across every channel, as the tab and the app icon show it. */
export function unreadTotal(channels: readonly ChatChannel[] | undefined): number {
    return (channels ?? []).reduce((n, c) => n + c.unread, 0);
}

/** The unread count on the app's icon (Android, and an iPhone with notifications allowed). */
export function useAppBadge(count: number) {
    useEffect(() => {
        const nav = navigator as Navigator & {
            setAppBadge?: (n?: number) => Promise<void>;
            clearAppBadge?: () => Promise<void>;
        };
        if (!nav.setAppBadge) return;
        void (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge?.())?.catch(() => {});
    }, [count]);
}
