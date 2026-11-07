import { noteAnswer, noteTrouble } from "@tea-pos/api-client/connection";
import { recordFailure, failureFor } from "@tea-pos/api-client/failures";
import { toast } from "@tea-pos/ui/toast";

import { openErrorSheet } from "../frame/ErrorSheet";

/**
 * Local only (`import.meta.env.DEV`): `?preview=<name>` in the address shows a toast, a sheet or a
 * connection state, to look at their design. Never in a build.
 */
export function showPreview(name: string) {
    const failure = () => {
        recordFailure({
            at: new Date().toISOString(),
            method: "POST",
            path: "/tenants/test-a/orders",
            status: 500,
            code: "internal",
            message: "pq: deadlock detected",
            requestId: "4f6c1a2e-9b3d-4e1f-8a7c-2d5e6f708192",
        });
        return failureFor({ code: "internal", status: 500 });
    };
    const previews: Record<string, () => void> = {
        success: () => toast("Order confirmed 3 items · Rp 21.000", { kind: "success" }),
        error: () => toast("This store has closed for today.", { kind: "error" }),
        warning: () => toast("Not saved: no connection. Try again.", { kind: "warning" }),
        info: () => toast("Copied", { kind: "info" }),
        detail: () =>
            toast("Couldn't load the orders", {
                kind: "error",
                detail: "Pull down to try again.",
            }),
        sheet: () =>
            openErrorSheet({
                title: "Couldn't save",
                text: "Something went wrong. Try again.",
                failure: failure(),
            }),
        offline: () => window.dispatchEvent(new Event("offline")),
        failing: () => noteTrouble(),
        slow: () => [1500, 1500, 1500, 1500, 1500].forEach((ms) => noteAnswer(ms)),
        online: () => {
            window.dispatchEvent(new Event("online"));
            [80, 80, 80, 80, 80].forEach((ms) => noteAnswer(ms));
        },
        // Offline, then back 2 s later: a fresh page was never offline, so `online` alone shows nothing.
        back: () => {
            previews.offline!();
            setTimeout(previews.online!, 2000);
        },
    };
    // Only the previews' own names: a name from the address never reaches Object's methods.
    if (Object.hasOwn(previews, name)) previews[name]!();
}
