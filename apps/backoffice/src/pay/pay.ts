import { $api, api } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import { useApiMutation } from "@tea-pos/shell/useApiMutation";
import { useTenant } from "@tea-pos/shell/tenant";
import { useQueryClient } from "@tanstack/react-query";

export const useSlug = () => useTenant()?.tenant.slug ?? "";

const path = (tenant: string) => ({ params: { path: { tenant } } });

export function usePayPeriod() {
    const tenant = useSlug();
    return $api.useQuery("get", "/tenants/{tenant}/pay/period", path(tenant), {
        enabled: !!tenant,
        staleTime: STALE.WARM,
    });
}

/** A pay period by any of its days (`current` for today's) and each person it pays. */
export function usePayPeriodAt(start: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/pay/periods/{start}",
        { params: { path: { tenant, start } } },
        { enabled: !!tenant && !!start, staleTime: STALE.QUICK },
    );
}

export function usePayStaff() {
    const tenant = useSlug();
    return $api.useQuery("get", "/tenants/{tenant}/pay/staff", path(tenant), {
        enabled: !!tenant,
        staleTime: STALE.COOL,
    });
}

export function useCommissionTypes() {
    const tenant = useSlug();
    return $api.useQuery("get", "/tenants/{tenant}/pay/commission-types", path(tenant), {
        enabled: !!tenant,
        staleTime: STALE.COLD,
    });
}

export function useClaimTypes() {
    const tenant = useSlug();
    return $api.useQuery("get", "/tenants/{tenant}/pay/claim-types", path(tenant), {
        enabled: !!tenant,
        staleTime: STALE.COLD,
    });
}

export function useClaimEligible(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/pay/claim-types/{id}/eligible",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant, staleTime: STALE.COOL },
    );
}

/** Throws the API's error ({status, code}) so useApiMutation shows it in words. */
function ok<T>(res: { data?: T; error?: unknown }): T {
    if (res.error) throw res.error;
    return res.data as T;
}

/** Every Pay setting write: saved once per action, then every Pay screen refetches. */
export function usePayWrite<V extends object>(
    write: (tenant: string, vars: V, key: string) => Promise<unknown>,
) {
    const tenant = useSlug();
    const queryClient = useQueryClient();
    return useApiMutation<unknown, V>(
        (vars, headers) => write(tenant, vars, headers["Idempotency-Key"]),
        {
            onSuccess: () =>
                void queryClient.invalidateQueries({
                    predicate: (q) =>
                        String(q.queryKey[1] ?? "").includes("/pay/") || q.queryKey[0] === "me",
                }),
        },
    );
}

const key = (k: string) => ({ "Idempotency-Key": k });

export const writes = {
    createCommissionType: (
        tenant: string,
        body: { name: string; slug: string; ratePerCup: number },
        k: string,
    ) =>
        api
            .POST("/tenants/{tenant}/pay/commission-types", {
                ...path(tenant),
                body,
                headers: key(k),
            })
            .then(ok),
    updateCommissionType: (
        tenant: string,
        { id, ...body }: { id: string; name?: string; enabled?: boolean; ratePerCup?: number },
        k: string,
    ) =>
        api
            .PATCH("/tenants/{tenant}/pay/commission-types/{id}", {
                params: { path: { tenant, id } },
                body,
                headers: key(k),
            })
            .then(ok),
    setStaffCommission: (
        tenant: string,
        { userId, commissionTypeId }: { userId: string; commissionTypeId: string | null },
        k: string,
    ) =>
        api
            .PUT("/tenants/{tenant}/pay/staff/{userId}/commission-type", {
                params: { path: { tenant, userId } },
                body: { commissionTypeId },
                headers: key(k),
            })
            .then(ok),
    createClaimType: (
        tenant: string,
        body: {
            name: string;
            slug: string;
            frequency: "daily" | "weekly" | "monthly" | "one_time";
            amount: number;
            source: "manual" | "auto" | "auto_submit";
            autoThresholdHours?: number;
        },
        k: string,
    ) =>
        api
            .POST("/tenants/{tenant}/pay/claim-types", { ...path(tenant), body, headers: key(k) })
            .then(ok),
    updateClaimType: (
        tenant: string,
        { id, ...body }: { id: string; name?: string; enabled?: boolean },
        k: string,
    ) =>
        api
            .PATCH("/tenants/{tenant}/pay/claim-types/{id}", {
                params: { path: { tenant, id } },
                body,
                headers: key(k),
            })
            .then(ok),
    setClaimEligible: (
        tenant: string,
        { id, userIds }: { id: string; userIds: string[] },
        k: string,
    ) =>
        api
            .PUT("/tenants/{tenant}/pay/claim-types/{id}/eligible", {
                params: { path: { tenant, id } },
                body: { userIds },
                headers: key(k),
            })
            .then(ok),
    setSchedule: (
        tenant: string,
        body: { frequency: "weekly" | "bi_weekly" | "four_weekly" },
        k: string,
    ) =>
        api
            .PUT("/tenants/{tenant}/pay/schedule", { ...path(tenant), body, headers: key(k) })
            .then(ok),
};

/** `Mon, 26 Oct 2026`, as the old Pay screens write a pay date. */
export function payDate(date: string, locale: string): string {
    return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
}

export function usePayslip(id: string) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/pay/payouts/{id}",
        { params: { path: { tenant, id } } },
        { enabled: !!tenant, staleTime: STALE.QUICK },
    );
}

type Decision = "pending" | "approved" | "rejected";

export const decisions = {
    commission: (tenant: string, { id, status }: { id: string; status: Decision }, k: string) =>
        api
            .PUT("/tenants/{tenant}/pay/commissions/{id}", {
                params: { path: { tenant, id } },
                body: { status },
                headers: key(k),
            })
            .then(ok),
    claim: (tenant: string, { id, status }: { id: string; status: Decision }, k: string) =>
        api
            .PUT("/tenants/{tenant}/pay/claims/{id}", {
                params: { path: { tenant, id } },
                body: { status },
                headers: key(k),
            })
            .then(ok),
    day: (
        tenant: string,
        { id, date, status }: { id: string; date: string; status: "approved" | "rejected" },
        k: string,
    ) =>
        api
            .POST("/tenants/{tenant}/pay/payouts/{id}/days/{date}/review", {
                params: { path: { tenant, id, date } },
                body: { status },
                headers: key(k),
            })
            .then(ok),
};
