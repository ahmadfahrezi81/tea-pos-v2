import createFetchClient from "openapi-fetch";
import createQueryHooks from "openapi-react-query";

import type { paths } from "./schema";

// Every app calls the API on its own address (/api, forwarded by the Cloudflare Worker): no CORS.
export const api = createFetchClient<paths>({ baseUrl: "/api" });

// A session that ended (expired, signed out elsewhere) sends the user to sign in again.
api.use({
    onResponse({ response }) {
        if (response.status === 401 && window.location.pathname !== "/login") {
            window.location.assign("/login");
        }
    },
});

// React Query hooks over the same client, e.g. $api.useQuery("get", "/health").
export const $api = createQueryHooks(api);

export type { components, paths } from "./schema";
