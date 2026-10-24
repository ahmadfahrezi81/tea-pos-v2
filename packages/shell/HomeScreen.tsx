import { useMe, type Me } from "@tea-pos/api-client/me";
import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useTenant } from "./tenant";

type Tenant = Me["tenants"][number];

/** The tenant's stores; the first real screens replace it (Steps 18 and 27). */
export function HomeScreen() {
    const tenant = useTenant()?.tenant;
    if (!tenant) return null;
    return <TenantCard tenant={tenant} />;
}

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

function TenantCard({ tenant }: { tenant: Tenant }) {
    const t = useT();
    // Default first, then by name (the API sorts by name).
    const stores = [...tenant.stores].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    return (
        <div className="rounded-2xl bg-white p-4">
            <p className="font-bold text-gray-900 mb-1">{tenant.name}</p>
            {stores.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">{t("home.noStores")}</p>
            ) : (
                <ul className="divide-y divide-gray-100">
                    {stores.map((store) => (
                        <li
                            key={store.id}
                            className={`flex justify-between gap-2 py-3 text-sm ${store.status === "active" ? "" : "opacity-60"}`}
                        >
                            <span className="text-gray-900 truncate">{store.name}</span>
                            <span className="text-gray-500 shrink-0">
                                {store.isDefault
                                    ? t("home.default")
                                    : store.status !== "active"
                                      ? t(`home.storeStatus.${store.status}` as MessageKey)
                                      : `${store.openTime}–${store.closeTime}`}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
