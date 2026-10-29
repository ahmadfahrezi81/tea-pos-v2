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

type Store = components["schemas"]["StoreLive"];

/**
 * The Store tab's home: every store right now, open ones first, with who is selling and
 * today's sales; a card opens that store. All stores together sits at the bottom.
 */
export function StoreList() {
    const t = useT();
    const slug = useTenant()?.tenant.slug ?? "";
    const { data } = useStoresLive();
    const stores = data?.stores;
    const open = stores?.filter((s) => s.open).length ?? 0;
    const sales = stores?.reduce((sum, s) => sum + s.sales, 0) ?? 0;

    return (
        <div className="flex flex-col gap-3">
            {stores ? (
                <p className="px-1 text-sm font-medium text-gray-600">
                    {t("store.openCount")
                        .replace("{open}", String(open))
                        .replace("{all}", String(stores.length))}{" "}
                    · {formatMoney(sales)} {t("store.today")}
                </p>
            ) : (
                <Skeleton className="h-5 w-48 rounded" />
            )}

            {stores
                ? stores.map((s) => <StoreCard key={s.id} store={s} slug={slug} />)
                : Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} delay={i * 80} className="h-28 rounded-2xl" />
                  ))}

            {stores && stores.length > 1 && (
                <Link
                    to="/$tenant/store/$storeId"
                    params={{ tenant: slug, storeId: ALL }}
                    className="flex items-center gap-3 rounded-2xl bg-white p-4 active:scale-[0.99]"
                >
                    <Layers size={ICON} className="text-gray-900" />
                    <span className="flex-1 text-gray-900">{t("shell.allStores")}</span>
                    <ChevronRight size={ICON} className="text-gray-400" />
                </Link>
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
            className="block rounded-2xl bg-white p-4 active:scale-[0.99]"
        >
            <div className="flex items-center justify-between gap-2">
                <p className="truncate text-lg font-bold text-gray-900">{s.name}</p>
                <OpenBadge store={s} />
            </div>
            <div className="mt-1.5 flex min-w-0 items-center gap-2 text-sm text-gray-600">
                {s.open ? (
                    <>
                        <Avatar url={s.sellerAvatar} size={24} />
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
            <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-gray-900">
                    {formatMoney(s.sales)} · {s.cups} {t("store.cupsUnit")}
                </span>
                <ChevronRight size={ICON} className="text-gray-400" />
            </div>
        </Link>
    );
}

export function OpenBadge({ store: s }: { store: Store }) {
    const t = useT();
    if (s.status !== "active" && !s.open)
        return (
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                {t(s.status === "fake" ? "store.demo" : "store.inactive")}
            </span>
        );
    return (
        <span
            className={`shrink-0 text-sm font-semibold ${s.open ? "text-green-600" : "text-gray-400"}`}
        >
            {s.open ? "●" : "○"} {t(s.open ? "store.open" : "store.closed")}
        </span>
    );
}
