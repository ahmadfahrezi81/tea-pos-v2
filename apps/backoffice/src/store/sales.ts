import { $api, api } from "@tea-pos/api-client";
import { useInfiniteList } from "@tea-pos/api-client/list";
import { STALE } from "@tea-pos/api-client/query";
import { localDate } from "@tea-pos/format";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { useParams, type SearchSchemaInput } from "@tanstack/react-router";

/** The store in the address (`/store/<storeId>/…`); `all` is every store of the tenant together. */
export function useStoreId(): string {
    return (useParams({ strict: false }) as { storeId?: string }).storeId ?? ALL;
}

export const ALL = "all";

/** The stores a Store screen adds up: the one in the address, or every store of the tenant. */
export function useStoreScope(): { tenant: string; storeId?: string[] } | null {
    const tenant = useTenant()?.tenant;
    const storeId = useStoreId();
    if (!tenant) return null;
    return { tenant: tenant.slug, storeId: storeId === ALL ? undefined : [storeId] };
}

/** Sales, orders and cups per day over the picked stores, `from` to `to` (both `2026-10-01`). */
export function useSalesDays(from: string, to: string) {
    const scope = useStoreScope();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/sales/days",
        {
            params: {
                path: { tenant: scope?.tenant ?? "" },
                query: { from, to, storeId: scope?.storeId },
            },
        },
        { enabled: !!scope, staleTime: STALE.COOL },
    );
}

/** `2026-10` as its first and last days. */
export function monthRange(month: string): [string, string] {
    const [y = 0, m = 1] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

/** A month of the picked stores' days, newest first, with expenses and who worked. */
export function useDays(month: string) {
    const scope = useStoreScope();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/days",
        {
            params: {
                path: { tenant: scope?.tenant ?? "" },
                query: { month, storeId: scope?.storeId },
            },
        },
        { enabled: !!scope, staleTime: STALE.COOL },
    );
}

/** One day's detail; its photo addresses last ten minutes, so it is fetched again after five. */
export function useDay(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/days/{id}",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant && !!id, staleTime: STALE.COLD },
    );
}

export function useDayActivity(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/days/{id}/activity",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant, staleTime: STALE.COLD },
    );
}

export function useDaySessions(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/days/{id}/sessions",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant, staleTime: STALE.COOL },
    );
}

export function useSalesProducts(from: string, to: string) {
    const scope = useStoreScope();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/sales/products",
        {
            params: {
                path: { tenant: scope?.tenant ?? "" },
                query: { from, to, storeId: scope?.storeId },
            },
        },
        { enabled: !!scope, staleTime: STALE.COOL },
    );
}

export function useTeaWaste(from: string, to: string) {
    const scope = useStoreScope();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/tea-waste",
        {
            params: {
                path: { tenant: scope?.tenant ?? "" },
                query: { from, to, storeId: scope?.storeId },
            },
        },
        { enabled: !!scope, staleTime: STALE.COOL },
    );
}

/** A Store screen's `?month=2026-10`, this month when absent or not a month. */
export function monthSearch(search: { month?: unknown } & SearchSchemaInput): { month: string } {
    const month =
        typeof search.month === "string" && /^\d{4}-\d{2}$/.test(search.month) ? search.month : "";
    return { month: month || localDate().slice(0, 7) };
}

/** A Store screen's `?date=2026-10-24`, today when absent or not a date. */
export function dateSearch(search: { date?: unknown } & SearchSchemaInput): { date: string } {
    const date =
        typeof search.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search.date)
            ? search.date
            : "";
    return { date: date || localDate() };
}

/** A day's cups and orders per hour, and its totals. Refetched when an order is made (017b). */
export function useSalesHours(date: string) {
    const scope = useStoreScope();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/sales/hours",
        {
            params: {
                path: { tenant: scope?.tenant ?? "" },
                query: { date, storeId: scope?.storeId },
            },
        },
        { enabled: !!scope, staleTime: STALE.WARM, meta: { live: ["order"] } },
    );
}

/** A day's orders, newest first, a page at a time. Refetched when an order is made (017b). */
export function useDayOrders(date: string) {
    const scope = useStoreScope();
    return useInfiniteList(
        ["store-orders", scope?.tenant, scope?.storeId ?? "all", date],
        async (cursor) => {
            const { data, error } = await api.GET("/tenants/{tenant}/orders", {
                params: {
                    path: { tenant: scope?.tenant ?? "" },
                    query: {
                        date,
                        storeId: scope?.storeId,
                        cursor: cursor || undefined,
                        limit: 30,
                    },
                },
            });
            if (error) throw error;
            return data;
        },
        ["order"],
    );
}

/** Every store right now. v1 writes without telling the hub, so it refetches every minute while on screen. */
export function useStoresLive() {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/stores/live",
        { params: { path: { tenant } } },
        {
            enabled: !!tenant,
            staleTime: STALE.WARM,
            refetchInterval: 60_000,
            meta: { live: ["order"] },
        },
    );
}

/** Today's cups by hour over exactly these stores (the Store list's filtered ones). */
export function useTodayHoursFor(storeIds: string[]) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/sales/hours",
        { params: { path: { tenant }, query: { date: localDate(), storeId: storeIds } } },
        {
            enabled: !!tenant && storeIds.length > 0,
            staleTime: STALE.WARM,
            refetchInterval: 60_000,
            meta: { live: ["order"] },
        },
    );
}
