import { useMe, type Me } from "@tea-pos/api-client/me";
import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { useQueryClient } from "@tanstack/react-query";

import { signOut } from "./session";
import { StatusScreen } from "./StatusScreen";

type Tenant = Me["tenants"][number];

// Google serves any size by URL; ask for 96 px, sharp at 48 px on a 2× screen.
const avatar = (url: string) =>
    url.includes("googleusercontent.com") ? url.replace(/=s\d+(-c)?$/, "") + "=s96-c" : url;

/** Who is signed in, their business and stores; the status card stays below until real screens arrive. */
export function HomeScreen() {
    const t = useT();
    const queryClient = useQueryClient();
    const me = useMe().data;
    if (!me) return null;
    const { user } = me;

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white p-4 flex items-center gap-3">
                {user.avatarUrl ? (
                    <img
                        src={avatar(user.avatarUrl)}
                        alt=""
                        width={48}
                        height={48}
                        referrerPolicy="no-referrer"
                        className="size-12 rounded-full"
                    />
                ) : (
                    <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500">
                        {user.fullName.slice(0, 1)}
                    </div>
                )}
                <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{user.fullName}</p>
                    <p className="text-sm text-gray-500 truncate">
                        {t(`home.roles.${user.role}` as MessageKey)} · {user.email}
                    </p>
                </div>
            </div>

            {me.tenants.length === 0 ? (
                <p className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                    {t("home.noTenant")}
                </p>
            ) : (
                me.tenants.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} />)
            )}

            <ActionButton
                action={() => signOut(queryClient)}
                busyLabel={t("home.signingOut")}
                className="rounded-2xl bg-white p-4 text-sm font-bold text-red-600"
            >
                {t("home.signOut")}
            </ActionButton>

            <StatusScreen />
        </div>
    );
}

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
