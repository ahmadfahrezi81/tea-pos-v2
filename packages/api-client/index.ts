import createFetchClient from "openapi-fetch";
import createQueryHooks from "openapi-react-query";

import type { paths } from "./schema";

// Every app calls the API on its own address (/api, forwarded by the Cloudflare Worker): no CORS.
export const api = createFetchClient<paths>({ baseUrl: "/api" });

// React Query hooks over the same client, e.g. $api.useQuery("get", "/health").
export const $api = createQueryHooks(api);

export type { components, paths } from "./schema";
