import { $api, api } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { useSlug } from "@tea-pos/shell/tenant";
import { useQueryClient } from "@tanstack/react-query";

export function useMyPay() {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/my/pay",
        { params: { path: { tenant } } },
        { enabled: !!tenant, staleTime: STALE.WARM },
    );
}

export function useMyPayslip(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/my/payouts/{id}",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant, staleTime: STALE.WARM },
    );
}

export function useMyWorkDays(from: string, to: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/my/work-days",
        { params: { path: { tenant }, query: { from, to } } },
        { enabled: !!tenant, staleTime: STALE.WARM },
    );
}

export function useMyClaims(from: string, to: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/my/claims",
        { params: { path: { tenant }, query: { from, to } } },
        { enabled: !!tenant, staleTime: STALE.QUICK },
    );
}

export function useMyClaimTypes() {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/my/claim-types",
        { params: { path: { tenant } } },
        { enabled: !!tenant, staleTime: STALE.QUICK },
    );
}

export function useCreateClaim() {
    const tenant = useSlug();
    const queryClient = useQueryClient();
    return useApiMutation<
        unknown,
        { typeId: string; date: string; storeId?: string; notes?: string; photoUrl?: string }
    >(
        async (body, headers) => {
            const res = await api.POST("/tenants/{tenant}/my/claims", {
                params: { path: { tenant } },
                body,
                headers,
            });
            if (res.error) throw res.error;
            return res.data;
        },
        {
            onSuccess: () =>
                void queryClient.invalidateQueries({
                    predicate: (q) => String(q.queryKey[1] ?? "").includes("/my/"),
                }),
        },
    );
}
