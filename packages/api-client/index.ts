import createFetchClient from "openapi-fetch";
import createQueryHooks from "openapi-react-query";

import type { paths } from "./schema";
import { createBrake } from "./brake";
import { APP_TAG, appTooOld, brakeTripped, setMaintenance } from "./status";

// Every app calls the API on its own address (/api, forwarded by the Cloudflare Worker): no CORS.
export const api = createFetchClient<paths>({ baseUrl: "/api" });

const brake = createBrake();
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
        // A write without its action's key (useApiMutation sets one) gets its own: Go needs one.
        if (request.method !== "GET" && !request.headers.has("Idempotency-Key")) {
            request.headers.set("Idempotency-Key", crypto.randomUUID());
        }
    },
    async onResponse({ response }) {
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
});

// React Query hooks over the same client, e.g. $api.useQuery("get", "/health").
export const $api = createQueryHooks(api);

export type { components, paths } from "./schema";
