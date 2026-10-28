import { $api, api } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { useTenant } from "@tea-pos/shell/tenant";
import { useQueryClient } from "@tanstack/react-query";
import type { components } from "@tea-pos/api-client";

export type Person = components["schemas"]["UacPerson"];
export type Change = components["schemas"]["UacPersonChange"];

const useSlug = () => useTenant()?.tenant.slug ?? "";

/** Requests waiting and everyone in the tenant; refetched when anyone's access changes. */
export function useUac() {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/uac",
        { params: { path: { tenant } } },
        { enabled: !!tenant, staleTime: STALE.QUICK, meta: { live: ["access"] } },
    );
}

export function useUacPerson(userId: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/uac/people/{userId}",
        { params: { path: { tenant, userId } } },
        { enabled: !!tenant, staleTime: STALE.QUICK, meta: { live: ["access"] } },
    );
}

/** Saves a person's levels, stores and status at once, then UAC and /me refetch. */
export function useSetPerson(userId: string) {
    const tenant = useSlug();
    const queryClient = useQueryClient();
    return useApiMutation<unknown, Change>(
        async (body, headers) => {
            const res = await api.PUT("/tenants/{tenant}/uac/people/{userId}", {
                params: { path: { tenant, userId } },
                body,
                headers,
            });
            if (res.error) throw res.error;
            return res.data;
        },
        {
            onSuccess: () =>
                void queryClient.invalidateQueries({
                    predicate: (q) =>
                        String(q.queryKey[1] ?? "").includes("/uac") || q.queryKey[0] === "me",
                }),
        },
    );
}

export function useUacRequest(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/uac/requests/{id}",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant, staleTime: STALE.QUICK, retry: false, meta: { live: ["access"] } },
    );
}

const refetchUac = (queryClient: ReturnType<typeof useQueryClient>) =>
    void queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[1] ?? "").includes("/uac"),
    });

/** Lets the person in with these levels and stores; they become a member at once. */
export function useApprove(id: string) {
    const tenant = useSlug();
    const queryClient = useQueryClient();
    return useApiMutation<unknown, Change>(
        async (body, headers) => {
            const res = await api.POST("/tenants/{tenant}/uac/requests/{id}/approve", {
                params: { path: { tenant, id } },
                body,
                headers,
            });
            if (res.error) throw res.error;
            return res.data;
        },
        { onSuccess: () => refetchUac(queryClient) },
    );
}

/** Turns a request down; `block` also drops the person's later asks. */
export function useReject(id: string) {
    const tenant = useSlug();
    const queryClient = useQueryClient();
    return useApiMutation<unknown, { block: boolean }>(
        async (body, headers) => {
            const res = await api.POST("/tenants/{tenant}/uac/requests/{id}/reject", {
                params: { path: { tenant, id } },
                body,
                headers,
            });
            if (res.error) throw res.error;
            return null;
        },
        { onSuccess: () => refetchUac(queryClient) },
    );
}
