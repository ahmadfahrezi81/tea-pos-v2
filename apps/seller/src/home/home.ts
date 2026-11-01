import { $api, api } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import type { components } from "@tea-pos/api-client";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { useSlug, useTenant } from "@tea-pos/shell/tenant";
import { useQueryClient } from "@tanstack/react-query";

export type Product = components["schemas"]["Product"];
export type Gate = components["schemas"]["StoreGate"];

/** The store the seller works in, chosen in the header. */
export function useStoreId(): string {
    return useTenant()?.store?.id ?? "";
}

export function useProducts() {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/products",
        { params: { path: { tenant } } },
        { enabled: !!tenant, staleTime: STALE.COOL },
    );
}

/** Today at the store; every phone on it follows the hub. */
export function useGate() {
    const tenant = useSlug();
    const storeId = useStoreId();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/stores/{storeId}/gate",
        { params: { path: { tenant, storeId } } },
        {
            enabled: !!tenant && !!storeId,
            staleTime: STALE.QUICK,
            meta: { live: ["day", "order"] },
        },
    );
}

/** A write about the store, then every screen showing it refetches. */
function useStoreWrite<V extends object>(
    write: (
        params: { path: { tenant: string; storeId: string } },
        vars: V,
        headers: { "Idempotency-Key": string },
    ) => Promise<{ data?: unknown; error?: unknown }>,
) {
    const tenant = useSlug();
    const storeId = useStoreId();
    const queryClient = useQueryClient();
    return useApiMutation<unknown, V>(
        async (vars, headers) => {
            const res = await write({ path: { tenant, storeId } }, vars, headers);
            if (res.error) throw res.error;
            return res.data;
        },
        {
            onSuccess: () =>
                void queryClient.invalidateQueries({
                    predicate: (q) =>
                        /\/stores\/|\/orders|\/days/.test(String(q.queryKey[1] ?? "")),
                }),
        },
    );
}

export const useOpenStore = () =>
    useStoreWrite<{
        openingBalance: number;
        cashBreakdown?: Record<string, number>;
        photoUrl?: string;
    }>((params, body, headers) =>
        api.POST("/tenants/{tenant}/stores/{storeId}/open", { params, body, headers }),
    );

export const useResumeStore = () =>
    useStoreWrite<object>((params, _, headers) =>
        api.POST("/tenants/{tenant}/stores/{storeId}/resume", { params, headers }),
    );

export const useTakeOver = () =>
    useStoreWrite<{ claimCode: string }>((params, body, headers) =>
        api.POST("/tenants/{tenant}/stores/{storeId}/take-over", { params, body, headers }),
    );

export const useCreateOrder = () =>
    useStoreWrite<{ items: { productId: string; quantity: number; unitPrice: number }[] }>(
        (params, body, headers) =>
            api.POST("/tenants/{tenant}/stores/{storeId}/orders", { params, body, headers }),
    );

export type PhotoSlot =
    "opening" | "closing:ice" | "closing:syrup" | "closing:bags" | "closing:cups" | "closing:tea";

/** A day of this store in full; every phone on it follows the hub. */
export function useStoreDay(dayId: string | undefined) {
    const tenant = useSlug();
    const storeId = useStoreId();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/stores/{storeId}/days/{dayId}",
        { params: { path: { tenant, storeId, dayId: dayId ?? "" } } },
        {
            enabled: !!tenant && !!storeId && !!dayId,
            staleTime: STALE.QUICK,
            meta: { live: ["day", "order"] },
        },
    );
}

export const useAddExpense = () =>
    useStoreWrite<{ dayId: string; type: string; amount: number }>(
        ({ path }, { dayId, ...body }, headers) =>
            api.POST("/tenants/{tenant}/stores/{storeId}/days/{dayId}/expenses", {
                params: { path: { ...path, dayId } },
                body,
                headers,
            }),
    );

export const useSaveDayPhoto = () =>
    useStoreWrite<{
        dayId: string;
        type: PhotoSlot;
        url?: string;
        quantity?: { value: number; unit: string };
    }>(({ path }, { dayId, type, ...body }, headers) =>
        api.PUT("/tenants/{tenant}/stores/{storeId}/days/{dayId}/photos/{type}", {
            params: { path: { ...path, dayId, type } },
            body,
            headers,
        }),
    );

export const useCloseDay = () =>
    useStoreWrite<{ dayId: string; actualCash: number }>(({ path }, { dayId, ...body }, headers) =>
        api.POST("/tenants/{tenant}/stores/{storeId}/days/{dayId}/close", {
            params: { path: { ...path, dayId } },
            body,
            headers,
        }),
    );
