import createFetchClient from "openapi-fetch";
import createQueryHooks from "openapi-react-query";

import type { paths } from "./schema";
import { APP_TAG, appTooOld, setMaintenance } from "./status";

// Every app calls the API on its own address (/api, forwarded by the Cloudflare Worker): no CORS.
export const api = createFetchClient<paths>({ baseUrl: "/api" });

api.use({
    onRequest({ request }) {
        request.headers.set("X-App-Version", APP_TAG);
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
