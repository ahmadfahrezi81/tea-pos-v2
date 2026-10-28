import { api } from "@tea-pos/api-client";
import { ME_KEY, useMe } from "@tea-pos/api-client/me";
import { useT } from "@tea-pos/i18n/react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";

import { useTenant } from "./tenant";
import { useApiMutation } from "./useApiMutation";

/** Where `/` goes: the user's tenant (the last one used, else the first), or why there is none. */
export function GoToTenant() {
    const t = useT();
    const me = useMe().data;
    const navigate = useNavigate();
    const slug = me && (me.tenants.find((x) => x.slug === lastTenant()) ?? me.tenants[0])?.slug;
    useEffect(() => {
        if (slug) void navigate({ to: "/$tenant", params: { tenant: slug }, replace: true });
    }, [slug, navigate]);
    if (!me || slug) return null;
    return <p className="rounded-2xl bg-white p-4 text-sm text-gray-700">{t("home.noTenant")}</p>;
}

/** Guards `/<tenant>/…`: a slug that is not one of the user's says so. */
export function TenantGuard() {
    const me = useMe().data;
    const tenant = useTenant()?.tenant;
    useEffect(() => {
        if (tenant) rememberTenant(tenant.slug);
    }, [tenant]);
    if (!me) return null;
    if (!tenant) return <RequestAccess />;
    return <Outlet />;
}

/** A tenant's address the user is not in: they ask to join, and wait for its admin. */
function RequestAccess() {
    const t = useT();
    const queryClient = useQueryClient();
    const { tenant: slug } = useParams({ strict: false }) as { tenant: string };
    const asked = useMe().data?.asked.includes(slug);
    const ask = useApiMutation<unknown, { tenant: string }>(
        async (body) => {
            const res = await api.POST("/access-requests", { body });
            if (res.error) throw res.error;
            return null;
        },
        { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ME_KEY }) },
    );
    return (
        <div className="space-y-3 rounded-2xl bg-white p-5 text-center">
            <p className="text-lg font-bold text-gray-900">{t("shell.noAccessTitle")}</p>
            <p className="text-sm text-gray-600">
                {t(asked ? "shell.requestSent" : "shell.noAccessBody")}
            </p>
            {!asked && (
                <button
                    onClick={() => ask.mutate({ tenant: slug })}
                    disabled={ask.isPending}
                    className="w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-60"
                >
                    {t("shell.requestAccess")}
                </button>
            )}
        </div>
    );
}

const TENANT_KEY = "tea-pos:tenant";
const lastTenant = () => {
    try {
        return localStorage.getItem(TENANT_KEY);
    } catch {
        return null;
    }
};
const rememberTenant = (slug: string) => {
    try {
        localStorage.setItem(TENANT_KEY, slug);
    } catch {
        // The first tenant opens instead.
    }
};
