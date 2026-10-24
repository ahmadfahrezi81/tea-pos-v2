import type { Me } from "@tea-pos/api-client/me";
import { useParams } from "@tanstack/react-router";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

import { useApp } from "./AppContext";

type Tenant = Me["tenants"][number];
type Store = Tenant["stores"][number];

interface TenantState {
    tenant: Tenant;
    /** The stores the picker offers (inactive ones hidden in backoffice when asked). */
    stores: Store[];
    /** The chosen store; null is All stores (backoffice only). */
    store: Store | null;
    setStore: (id: string | null) => void;
    hideInactive: boolean;
    setHideInactive: (hide: boolean) => void;
    /** The user's flags, and the chosen store's (016b: rules on role, app, tenant, store). */
    flags: Record<string, boolean>;
}

const TenantContext = createContext<TenantState | null>(null);

const read = (key: string) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};
// Private mode (no storage): the choice lasts until the app closes.
const memory = new Map<string, string | null>();
const listeners = new Set<() => void>();
const write = (key: string, value: string | null) => {
    memory.set(key, value);
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
    } catch {
        // Kept in memory above.
    }
    for (const fn of listeners) fn();
};

/** A saved choice, re-read when it changes. */
function useSaved(key: string): string | null {
    return useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => (memory.has(key) ? memory.get(key)! : read(key)),
    );
}

/**
 * The tenant in the address (`/<tenant>/…`) and the store the app works in or looks at,
 * kept on the phone per user and tenant so a reopen lands where it was left. Seller must
 * have one store (its default, else the first open); backoffice also has All stores, its
 * default (app.config.ts `stores`). Every screen's queries take the chosen store's id.
 */
export function TenantProvider({ me, children }: { me: Me | undefined; children: ReactNode }) {
    const { stores: mode } = useApp();
    const { tenant: slug } = useParams({ strict: false }) as { tenant?: string };
    const tenant = me?.tenants.find((t) => t.slug === slug);
    const key = tenant && me ? `tea-pos:store:${me.user.id}:${tenant.id}` : "";
    const hideKey = "tea-pos:hide-inactive-stores";

    const saved = useSaved(key);
    const hideSaved = useSaved(hideKey);
    const hideInactive = mode === "all" && hideSaved === "1";

    if (!tenant) return <TenantContext value={null}>{children}</TenantContext>;

    const open = tenant.stores.filter((s) => s.status === "active");
    const stores = hideInactive ? open : tenant.stores;
    let store: Store | null =
        tenant.stores.find((s) => s.id === saved && (mode === "all" || s.status === "active")) ??
        null;
    if (!store && mode === "one") {
        store = open.find((s) => s.isDefault) ?? open[0] ?? tenant.stores[0] ?? null;
    }

    const value: TenantState = {
        tenant,
        stores,
        store,
        setStore: (id) => write(key, id),
        hideInactive,
        setHideInactive: (hide) => write(hideKey, hide ? "1" : null),
        flags: { ...me?.flags, ...store?.flags },
    };
    return <TenantContext value={value}>{children}</TenantContext>;
}

/** The tenant in the address and the chosen store; null outside a tenant (or one not the user's). */
export function useTenant(): TenantState | null {
    return useContext(TenantContext);
}

/**
 * Whether a flag is on for this user at the chosen store. The screen's choice only: the
 * route behind it must check the flag in Go too (the RFC's rule), or hiding a button is all it does.
 */
export function useFlag(key: string): boolean {
    return useTenant()?.flags[key] ?? false;
}
