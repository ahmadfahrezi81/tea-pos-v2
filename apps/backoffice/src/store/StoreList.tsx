import type { components } from "@tea-pos/api-client";
import { formatDay, formatMoney, formatTime } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { useTenant } from "@tea-pos/shell/tenant";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Layers } from "lucide-react";

import { ALL, useStoresLive } from "./sales";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { Badge } from "@tea-pos/ui/Badge";

type Store = components["schemas"]["StoreLive"];

/**
 * The Store tab's home: the real stores right now (demo and closed-down ones stay out), open
 * first, with who is selling and today's sales; a card opens that store. All stores at the bottom.
 */
export function StoreList() {
    const t = useT();
    const slug = useTenant()?.tenant.slug ?? "";
    const { data } = useStoresLive();
    const stores = data?.stores.filter((s) => s.status === "active");

    return (
        <div className="flex flex-col gap-3">
            {!stores ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} delay={i * 80} className="h-28 rounded-2xl" />
                ))
            ) : stores.length === 0 ? (
                <EmptyState title={t("store.noStores")} />
            ) : (
                stores.map((s) => <StoreCard key={s.id} store={s} slug={slug} />)
            )}

            {stores && stores.length > 1 && (
                <SettingsGroup>
                    <SettingsRow
                        to={`/${slug}/store/${ALL}`}
                        icon={<Layers {...rowIcon} />}
                        label={t("shell.allStores")}
                    />
                </SettingsGroup>
            )}
        </div>
    );
}

function StoreCard({ store: s, slug }: { store: Store; slug: string }) {
    const t = useT();
    const locale = useLocale();
    return (
        <Link
            to="/$tenant/store/$storeId"
            params={{ tenant: slug, storeId: s.id }}
            className="block rounded-2xl bg-white p-4 space-y-2 active:scale-[0.99]"
        >
            <div className="flex items-center justify-between gap-2">
                <p className="truncate text-lg font-bold text-gray-900">{s.name}</p>
                <OpenBadge store={s} />
            </div>
            <div className="flex min-w-0 items-center gap-2 text-sm text-gray-900">
                {s.open ? (
                    <>
                        <Avatar url={s.sellerAvatar} size={24} square />
                        <span className="truncate">
                            {t("store.sellerSince")
                                .replace("{name}", s.sellerName ?? "")
                                .replace(
                                    "{time}",
                                    s.openSince ? formatTime(s.openSince, locale) : "",
                                )}
                        </span>
                    </>
                ) : (
                    <span className="truncate">
                        {s.lastClosed
                            ? t("store.closedAt").replace(
                                  "{when}",
                                  `${formatTime(s.lastClosed, locale)} ${formatDay(s.lastClosed, locale).toLowerCase()}`,
                              )
                            : t("store.notOpened")}
                    </span>
                )}
            </div>
            <div className="flex items-center justify-between border-t-2 border-slate-100 pt-2">
                <span className="text-base font-bold text-gray-900">
                    {formatMoney(s.sales)}
                    <span className="ml-2 text-sm font-medium">
                        {s.cups} {t("store.cupsUnit")}
                    </span>
                </span>
                <ChevronRight size={ICON} strokeWidth={2.5} className="text-brand/90" />
            </div>
        </Link>
    );
}

/** Open or Closed (Demo or Shut down for those), as a badge. */
export function OpenBadge({ store: s }: { store: Store }) {
    const t = useT();
    const key =
        s.status !== "active" && !s.open
            ? s.status === "fake"
                ? "store.demo"
                : "store.inactive"
            : s.open
              ? "store.open"
              : "store.closed";
    return <Badge>{t(key)}</Badge>;
}
