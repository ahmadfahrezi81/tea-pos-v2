import { onBraked } from "@tea-pos/api-client/status";
import { useT } from "@tea-pos/i18n/react";
import { toast } from "@tea-pos/ui/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { errorMessage } from "../session/errors";

/** Handled elsewhere: sign in, the maintenance or update screen, or the brake's own toast. */
const QUIET = new Set([
    "not_signed_in",
    "not_allowed",
    "maintenance",
    "app_too_old",
    "too_many_requests",
]);

/** The same words are not shown twice within this. */
const REPEAT_MS = 10_000;

/**
 * Says what failed where the screen cannot: a refresh that failed behind data still on screen
 * (a first load shows LoadFailed in place), and the brake stopping a loop, which is also reported.
 */
export function useErrorToasts() {
    const t = useT();
    const queryClient = useQueryClient();

    useEffect(() => {
        const shown = new Map<string, number>();
        const say = (text: string) => {
            const now = Date.now();
            if (now - (shown.get(text) ?? 0) < REPEAT_MS) return;
            shown.set(text, now);
            toast(text);
        };
        const offQueries = queryClient.getQueryCache().subscribe((event) => {
            if (event.type !== "updated" || event.action.type !== "error") return;
            if (event.query.state.data === undefined) return;
            const error = event.action.error as { code?: string; message?: string } | null;
            if (QUIET.has(error?.code ?? error?.message ?? "")) return;
            say(errorMessage(t, error));
        });
        const offBrake = onBraked((path) => {
            say(errorMessage(t, { code: "too_many_requests" }));
            void import("../lib/events").then((m) =>
                m.reportError(new Error(`client brake: ${path} called too often`)),
            );
        });
        return () => {
            offQueries();
            offBrake();
        };
    }, [t, queryClient]);
}
