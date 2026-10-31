import { $api, api } from "@tea-pos/api-client";
import { useInfiniteList } from "@tea-pos/api-client/list";
import { STALE } from "@tea-pos/api-client/query";
import { formatMoney, localDate } from "@tea-pos/format";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { useParams, type SearchSchemaInput } from "@tanstack/react-router";

/** The store in the address (`/store/<storeId>/…`); `all` is every store of the tenant together. */
export function useStoreId(): string {
    return (useParams({ strict: false }) as { storeId?: string }).storeId ?? ALL;
}

export const ALL = "all";

/** The stores a Store screen adds up: the one in the address, or every real store of the tenant. */
export function useStoreScope(): { tenant: string; storeId?: string[] } | null {
    const tenant = useTenant()?.tenant;
    const storeId = useStoreId();
    if (!tenant) return null;
    return {
        tenant: tenant.slug,
        storeId:
            storeId === ALL
                ? tenant.stores.filter((s) => s.status === "active").map((s) => s.id)
                : [storeId],
    };
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
        { enabled: !!scope && !!from, staleTime: STALE.COOL },
    );
}

/** The picked stores' days in a range, newest first, with expenses and who worked. */
export function useDays(from: string, to: string, enabled = true) {
    const scope = useStoreScope();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/days",
        {
            params: {
                path: { tenant: scope?.tenant ?? "" },
                query: { from, to, storeId: scope?.storeId },
            },
        },
        { enabled: !!scope && enabled, staleTime: STALE.COOL },
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
        {
            enabled: !!scope && !!date,
            staleTime: STALE.WARM,
            refetchInterval: date === localDate() ? 60_000 : false,
            meta: { live: ["order"] },
        },
    );
}

/** A range's orders, newest first, a page at a time. Refetched when an order is made (017b). */
export function useRangeOrders(from: string, to: string) {
    const scope = useStoreScope();
    return useInfiniteList(
        ["store-orders", scope?.tenant, scope?.storeId ?? "all", from, to],
        async (cursor) => {
            const { data, error } = await api.GET("/tenants/{tenant}/orders", {
                params: {
                    path: { tenant: scope?.tenant ?? "" },
                    query: {
                        from,
                        to,
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

/** A store page's snippet: only the newest few. Refetched while a live range is on screen. */
export function useLatestOrders(from: string, to: string) {
    const scope = useStoreScope();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/orders",
        {
            params: {
                path: { tenant: scope?.tenant ?? "" },
                query: { from, to, storeId: scope?.storeId, limit: 5 },
            },
        },
        {
            enabled: !!scope,
            staleTime: STALE.WARM,
            refetchInterval: to === localDate() ? 60_000 : false,
            meta: { live: ["order"] },
        },
    );
}

/** Every store, with a range's sales. v1 writes without telling the hub, so it refetches every minute while on screen. */
export function useStoresLive(from: string, to: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/stores/live",
        { params: { path: { tenant }, query: { from, to } } },
        {
            enabled: !!tenant,
            staleTime: STALE.WARM,
            // A past range does not change.
            refetchInterval: to === localDate() ? 60_000 : false,
            meta: { live: ["order"] },
        },
    );
}

/** The stores a screen adds up, from the live list, and their totals: real stores, or the one in the address. */
export function useScopeStores(from: string, to: string) {
    const storeId = useStoreId();
    const stores = useStoresLive(from, to).data?.stores.filter((s) =>
        storeId === ALL ? s.status === "active" : s.id === storeId,
    );
    const sum = (k: "sales" | "cups" | "orders") => (stores ?? []).reduce((n, s) => n + s[k], 0);
    return {
        stores,
        totals: stores && { sales: sum("sales"), cups: sum("cups"), orders: sum("orders") },
    };
}

/** Rupiah without the `Rp`, for a tile. */
export const plain = (amount: number) => formatMoney(amount).replace(/^Rp\s*/, "");

/** A store's cash for one day: what it should hold while open, then what was counted. */
export const dayCash = (
    s: { opening: number; sales: number; expenses: number; cashCounted: number },
    open: boolean,
) => (open ? s.opening + s.sales - s.expenses : s.cashCounted);
