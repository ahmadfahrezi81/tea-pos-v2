import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { loadEarlier, threadKey, type Thread } from "./queries";

const scroller = () => document.getElementById("shell-scroll");
/** Further from the newest than this, the down arrow shows. */
const AWAY_PX = 300;
/** Older history starts loading this far before the top is reached. */
const EARLIER_MARGIN = "600px";
/** Room kept above a message jumped to: the sticky day and the New messages line. */
const ABOVE = 72;

/**
 * Where the reader is in a channel (task 068c): it opens at the first unread (else the newest),
 * follows new messages only while at the bottom, counts the ones that came while scrolled up
 * (the down arrow), and loads older history near the top without moving what is on screen.
 */
export function useChannelScroll({
    ids,
    firstNew,
    jumpTo,
    sent,
}: {
    /** Every message shown, oldest first, held and waiting. */
    ids: string[];
    /** The first unread message's id, where the channel opens. */
    firstNew?: string;
    /** A message to open at instead (Activity, a link). */
    jumpTo?: string;
    /** Messages this phone has sent while here: each one goes to the bottom. */
    sent: number;
}) {
    const end = useRef<HTMLDivElement>(null);
    const opened = useRef(false);
    const lastNewest = useRef<string | undefined>(undefined);
    const newest = ids.at(-1);
    const count = ids.length;
    const lastSent = useRef(sent);
    const [away, setAway] = useState(false);
    const [fresh, setFresh] = useState(0);
    const awayRef = useRef(false);

    useLayoutEffect(() => {
        const s = scroller();
        if (!s || !end.current || count === 0) return;
        // Only what came after the newest one held is new; older history loading is not.
        const was = lastNewest.current;
        lastNewest.current = newest;
        const added = was && newest !== was ? count - 1 - ids.lastIndexOf(was) : 0;
        if (!opened.current) {
            opened.current = true;
            const at = jumpTo ?? firstNew;
            const el = at ? messageEl(at) : null;
            if (el) {
                s.scrollTop +=
                    el.getBoundingClientRect().top - s.getBoundingClientRect().top - ABOVE;
                if (jumpTo) flash(el);
            } else end.current.scrollIntoView({ block: "end" });
            return;
        }
        if (sent > lastSent.current) {
            lastSent.current = sent;
            end.current.scrollIntoView({ block: "end", behavior: "smooth" });
            return;
        }
        if (added <= 0 || added >= count) return;
        if (!awayRef.current) end.current.scrollIntoView({ block: "end" });
        else setFresh((n) => n + added);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ids change with newest
    }, [newest, count, firstNew, jumpTo, sent]);

    useEffect(() => {
        const s = scroller();
        if (!s) return;
        let atBottom = true;
        const onScroll = () => {
            const gap = s.scrollHeight - s.scrollTop - s.clientHeight;
            atBottom = gap < 40;
            const far = gap > AWAY_PX;
            if (far !== awayRef.current) {
                awayRef.current = far;
                setAway(far);
            }
            if (atBottom) setFresh(0);
        };
        // The page shrinking for the keyboard keeps the newest message in view, as chat apps do.
        const resized = new ResizeObserver(() => {
            if (atBottom) s.scrollTop = s.scrollHeight;
        });
        s.addEventListener("scroll", onScroll, { passive: true });
        resized.observe(s);
        return () => {
            s.removeEventListener("scroll", onScroll);
            resized.disconnect();
        };
    }, []);

    const toBottom = () => {
        setFresh(0);
        end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    };
    return { end, away, fresh, toBottom };
}

/** Older history as the top comes near; what is on screen stays exactly where it was. */
export function useEarlier(
    queryClient: QueryClient,
    tenant: string,
    channel: string,
    firstId: string | undefined,
    hasMore: boolean,
) {
    const top = useRef<HTMLDivElement>(null);
    const before = useRef<{ height: number; top: number } | null>(null);
    const [busy, setBusy] = useState(false);

    useLayoutEffect(() => {
        const s = scroller();
        const b = before.current;
        if (!s || !b) return;
        before.current = null;
        s.scrollTop = b.top + (s.scrollHeight - b.height);
    }, [firstId]);

    useEffect(() => {
        const el = top.current;
        const s = scroller();
        if (!el || !s || !hasMore || busy || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver(
            (entries) => {
                if (!entries.some((e) => e.isIntersecting)) return;
                io.disconnect();
                before.current = { height: s.scrollHeight, top: s.scrollTop };
                setBusy(true);
                void loadEarlier(queryClient, tenant, channel)
                    .catch(() => (before.current = null))
                    .finally(() => setBusy(false));
            },
            { root: s, rootMargin: `${EARLIER_MARGIN} 0px 0px 0px` },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [queryClient, tenant, channel, hasMore, busy]);

    return { top, busy };
}

const messageEl = (id: string) =>
    document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`);

function flash(el: HTMLElement) {
    el.classList.remove("animate-flash");
    void el.offsetWidth;
    el.classList.add("animate-flash");
}

/**
 * Scrolls to a message and lights it up: a reply's quote, an Activity row. Older history loads
 * first when it is not held yet (a few pages at most).
 */
export async function goToMessage(
    queryClient: QueryClient,
    tenant: string,
    channel: string,
    id: string,
) {
    for (let i = 0; i < 6; i++) {
        const el = messageEl(id);
        if (el) {
            el.scrollIntoView({ block: "center", behavior: "smooth" });
            flash(el);
            return;
        }
        const held = queryClient.getQueryData<Thread>(threadKey(tenant, channel));
        if (!held?.next) return;
        await loadEarlier(queryClient, tenant, channel);
        await new Promise((r) => requestAnimationFrame(r));
    }
}
