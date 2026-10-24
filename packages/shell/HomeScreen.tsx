import { useMe } from "@tea-pos/api-client/me";
import { useT } from "@tea-pos/i18n/react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useTenant } from "./tenant";

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
    const t = useT();
    const me = useMe().data;
    const tenant = useTenant()?.tenant;
    useEffect(() => {
        if (tenant) rememberTenant(tenant.slug);
    }, [tenant]);
    if (!me) return null;
    if (!tenant)
        return (
            <p className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                {t("shell.tenantNotFound")}
            </p>
        );
    return <Outlet />;
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
