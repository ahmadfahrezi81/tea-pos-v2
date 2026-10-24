import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { Me } from "./me";

/** What the hub sends: something of `kind` changed at `topic` (internal/realtime). */
interface LiveEvent {
    topic?: string;
    kind?: string;
    id?: string;
    error?: string;
}

/** A query says which kinds of change it shows: `meta: { live: ["order"] }`. */
declare module "@tanstack/react-query" {
    interface Register {
        queryMeta: { live?: readonly string[] };
    }
}

const ME_KEY: QueryKey = ["me"];
/** A phone in the background holds no socket after this. */
const CLOSE_AFTER_HIDDEN_MS = 60_000;
const MAX_RETRY_MS = 30_000;

/** The topics the user may watch: their own, their tenants', the stores /me lists. */
function topicsOf(me: Me | undefined): string[] {
    if (!me) return [];
    return [
        `user:${me.user.id}`,
        ...me.tenants.flatMap((t) => [`tenant:${t.id}`, ...t.stores.map((s) => `store:${s.id}`)]),
    ];
}

/**
 * Live updates for the whole app, over one socket to the hub (/api/realtime): a change
 * refetches only the queries on screen that show it. Open while the app is in front;
 * closed a minute after it goes to the background (nothing drains a parked phone); after any
 * gap every screen refetches once, so nothing is missed. Loaded after the first screen.
 */
export function startLive(queryClient: QueryClient) {
    let socket: WebSocket | null = null;
    let watching = new Set<string>();
    let retryMs = 1000;
    let retryTimer = 0;
    let hiddenTimer = 0;
    let hadGap = false;

    const me = () => queryClient.getQueryData<Me>(ME_KEY);

    const send = (msg: object) => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
    };

    // Keep the socket's topics equal to what /me says the user may see.
    const sync = () => {
        const want = new Set(topicsOf(me()));
        const subscribe = [...want].filter((t) => !watching.has(t));
        const unsubscribe = [...watching].filter((t) => !want.has(t));
        if (subscribe.length || unsubscribe.length) send({ subscribe, unsubscribe });
        watching = want;
    };

    const refetchAll = () => void queryClient.invalidateQueries({ refetchType: "active" });

    const onEvent = (e: LiveEvent) => {
        if (e.error) return;
        if (e.kind === "resync") return refetchAll();
        // Signed out somewhere: if it was here, /me answers 401 and sends this phone to sign in.
        if (e.kind === "signed_out")
            return void queryClient.invalidateQueries({ queryKey: ME_KEY });
        void queryClient.invalidateQueries({
            predicate: (q) => !!e.kind && (q.meta?.live?.includes(e.kind) ?? false),
            refetchType: "active",
        });
    };

    const open = () => {
        if (socket || document.visibilityState !== "visible" || !me()) return;
        const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/realtime`;
        const s = new WebSocket(url);
        socket = s;
        s.onopen = () => {
            retryMs = 1000;
            watching = new Set();
            sync();
            if (hadGap) refetchAll();
            hadGap = false;
        };
        s.onmessage = (m) => {
            try {
                onEvent(JSON.parse(String(m.data)) as LiveEvent);
            } catch {
                // Not ours to read.
            }
        };
        s.onclose = (e) => {
            if (socket === s) socket = null;
            hadGap = true;
            // 1008: this phone's session ended (signed out elsewhere); /me now answers 401.
            if (e.code === 1008) return void queryClient.invalidateQueries({ queryKey: ME_KEY });
            if (document.visibilityState !== "visible") return;
            // The hub restarting, a lost signal: try again, slower each time.
            retryTimer = window.setTimeout(open, retryMs);
            retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        };
    };

    const close = () => {
        window.clearTimeout(retryTimer);
        socket?.close();
        socket = null;
    };

    document.addEventListener("visibilitychange", () => {
        window.clearTimeout(hiddenTimer);
        if (document.visibilityState === "visible") return open();
        hiddenTimer = window.setTimeout(close, CLOSE_AFTER_HIDDEN_MS);
    });
    // /me arriving (or changing: a new store) opens the socket or changes its topics.
    queryClient.getQueryCache().subscribe((event) => {
        if (event.query.queryKey[0] !== ME_KEY[0] || event.type !== "updated") return;
        if (socket) sync();
        else open();
    });
    open();
}
