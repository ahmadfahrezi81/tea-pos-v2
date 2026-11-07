import createFetchClient from "openapi-fetch";
import createQueryHooks from "openapi-react-query";

import type { paths } from "./schema";
import { createBrake } from "./brake";
import { noteAnswer, noteTrouble } from "./connection";
import { recordFailure } from "./failures";
import { APP_TAG, appTooOld, brakeTripped, setMaintenance } from "./status";

// Every app calls the API on its own address (/api, forwarded by the Cloudflare Worker): no CORS.
export const api = createFetchClient<paths>({ baseUrl: "/api" });

const brake = createBrake();
// When each request left, to time its way to the API and back.
const started = new WeakMap<Request, number>();

/** Go's own time in a response (Server-Timing `app;dur=`), so only the way is left. */
function serverMs(response: Response): number {
    const m = /app;dur=([\d.]+)/.exec(response.headers.get("Server-Timing") ?? "");
    return m ? Number(m[1]) : 0;
}
const TOO_MANY = {
    status: 429,
    code: "too_many_requests",
    message: "Too many requests from this app",
};

api.use({
    async onRequest({ request }) {
        // Answered here, so a loop costs nothing past the phone; per address, not its query.
        const path = new URL(request.url).pathname;
        const verdict = brake(`${request.method} ${path}`);
        if (!verdict.go) {
            if (verdict.tripped) brakeTripped(path);
            await new Promise((resolve) => setTimeout(resolve, verdict.waitMs));
            return new Response(JSON.stringify(TOO_MANY), {
                status: 429,
                headers: { "Content-Type": "application/json" },
            });
        }
        request.headers.set("X-App-Version", APP_TAG);
        started.set(request, performance.now());
        // A write without its action's key (useApiMutation sets one) gets its own: Go needs one.
        if (request.method !== "GET" && !request.headers.has("Idempotency-Key")) {
            request.headers.set("Idempotency-Key", crypto.randomUUID());
        }
    },
    async onResponse({ request, response }) {
        // Cloudflare's own answer when the API is down or too slow: the way to it fails.
        if ([502, 504, 522, 524].includes(response.status)) noteTrouble();
        else {
            const at = started.get(request);
            noteAnswer(at === undefined ? undefined : performance.now() - at - serverMs(response));
        }
        if (!response.ok) {
            const body = (await response
                .clone()
                .json()
                .catch(() => null)) as { code?: string; message?: string } | null;
            recordFailure({
                at: new Date().toISOString(),
                method: request.method,
                path: new URL(request.url).pathname,
                status: response.status,
                code: body?.code,
                message: body?.message,
                requestId: response.headers.get("X-Request-Id") ?? undefined,
            });
        }
        // A session that ended (expired, signed out elsewhere) sends the user to sign in again.
        if (response.status === 401 && window.location.pathname !== "/login") {
            window.location.assign("/login");
        }
        if (response.status === 426) appTooOld();
        if (response.status === 503) {
            const body = (await response
                .clone()
                .json()
                .catch(() => null)) as { code?: string } | null;
            if (body?.code === "maintenance") setMaintenance(true);
        } else if (response.ok) {
            setMaintenance(false);
        }
    },
    onError({ request, error }) {
        // Cancelled by the app (a screen left before its data came): not the connection's fault.
        if ((error as Error | null)?.name === "AbortError") return;
        // No answer at all: no network, a dead connection, or the time limit.
        if (navigator.onLine) noteTrouble();
        recordFailure({
            at: new Date().toISOString(),
            method: request.method,
            path: new URL(request.url).pathname,
            message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
    },
});

// React Query hooks over the same client, e.g. $api.useQuery("get", "/health").
export const $api = createQueryHooks(api);

export type { components, paths } from "./schema";
