import type { components } from "@tea-pos/api-client";
import { formatDay, formatMoney, formatTime } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { useSearchParam, useSearchText, useSetSearch } from "@tea-pos/shell/searchParam";
import { useTenant } from "@tea-pos/shell/tenant";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Layers } from "lucide-react";

import { ALL, useStoresLive, useTodayHoursFor } from "./sales";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { ICON } from "@tea-pos/ui/icon";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { Badge } from "@tea-pos/ui/Badge";
import { Sellers } from "./Sellers";
import { TodayPanel } from "./TodayPanel";
import { Sheet } from "@tea-pos/ui/Sheet";
import { SearchBox } from "@tea-pos/ui/SearchBox";
import { Switch } from "@tea-pos/ui/form/Switch";
import { FilterButton } from "@tea-pos/ui/FilterButton";
import { ChoiceList } from "@tea-pos/ui/ChoiceList";
import { useState } from "react";
import type { MessageKey } from "@tea-pos/i18n";

type Store = components["schemas"]["StoreLive"];

type StoreType = "active" | "fake" | "inactive" | "all";
type StoreFilter = { type: StoreType; openOnly: boolean };
const NO_FILTER: StoreFilter = { type: "active", openOnly: false };

const TYPE_KEYS: Record<StoreType, MessageKey> = {
    active: "store.real",
    fake: "store.demoStores",
    inactive: "store.shutDown",
    all: "store.allTypes",
};

/**
 * The Store tab's home: today's sales over the stores shown, then each store (real ones by
 * default; search and the filter change which), open first, with who sold and their cups.
 */
export function StoreList() {
    const t = useT();
    const slug = useTenant()?.tenant.slug ?? "";
    const { data } = useStoresLive();
    const [search, setSearch] = useSearchText();
    const [type] = useSearchParam("type");
    const [open] = useSearchParam("open");
    const setSearchParams = useSetSearch();
    const filter: StoreFilter = {
        type: (type || NO_FILTER.type) as StoreType,
        openOnly: open === "1",
    };
    const setFilter = (f: StoreFilter) =>
        setSearchParams({
            type: f.type === NO_FILTER.type ? "" : f.type,
            open: f.openOnly ? "1" : "",
        });
    const [filtering, setFiltering] = useState(false);
    const q = search.trim().toLowerCase();
    const stores = data?.stores.filter(
        (s) =>
            (filter.type === "all" || s.status === filter.type) &&
            (!filter.openOnly || s.open) &&
            (!q || s.name.toLowerCase().includes(q)),
    );
    const filtered = filter.type !== NO_FILTER.type || filter.openOnly;

    return (
        <div className="flex flex-col gap-3">
            <TodayOver stores={stores} />

            <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                    <SearchBox
                        value={search}
                        onChange={setSearch}
                        placeholder={t("store.search")}
                        clearLabel={t("common.close")}
                    />
                </div>
                <FilterButton
                    active={filtered}
                    label={t("store.filter")}
                    onClick={() => setFiltering(true)}
                />
            </div>

            {!stores ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} delay={i * 80} className="h-28 rounded-2xl" />
                ))
            ) : stores.length === 0 ? (
                q || filtered ? (
                    <EmptyState title={t("store.noMatch")} body={t("store.noMatchBody")} />
                ) : (
                    <EmptyState title={t("store.noStores")} />
                )
            ) : (
                stores.map((s) => <StoreCard key={s.id} store={s} slug={slug} />)
            )}

            {data && data.stores.length > 1 && (
                <SettingsGroup>
                    <SettingsRow
                        to={`/${slug}/store/${ALL}`}
                        icon={<Layers {...rowIcon} />}
                        label={t("shell.allStores")}
                    />
                </SettingsGroup>
            )}

            <Sheet open={filtering} onClose={() => setFiltering(false)} title={t("store.filter")}>
                <div className="space-y-4">
                    <div className="-mx-4 space-y-2">
                        <p className="pl-7 text-xs font-bold uppercase tracking-widest text-gray-900">
                            {t("store.type")}
                        </p>
                        <ChoiceList
                            value={filter.type}
                            onChange={(type) => setFilter({ ...filter, type })}
                            choices={(Object.keys(TYPE_KEYS) as StoreType[]).map((v) => ({
                                value: v,
                                label: t(TYPE_KEYS[v]),
                            }))}
                        />
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-4">
                        <p className="flex-1 text-[17px] font-medium text-gray-900">
                            {t("store.openOnly")}
                        </p>
                        <Switch
                            on={filter.openOnly}
                            onChange={(openOnly) => setFilter({ ...filter, openOnly })}
                            label={t("store.openOnly")}
                        />
                    </div>
                </div>
            </Sheet>
        </div>
    );
}

/** Today over the stores shown. */
function TodayOver({ stores }: { stores: Store[] | undefined }) {
    const hours = useTodayHoursFor((stores ?? []).map((s) => s.id));
    const sum = (k: "sales" | "cups" | "orders") => (stores ?? []).reduce((n, s) => n + s[k], 0);
    const totals = stores && { sales: sum("sales"), cups: sum("cups"), orders: sum("orders") };
    return <TodayPanel totals={totals} hours={stores?.length ? hours.data?.hours : []} />;
}

function StoreCard({ store: s, slug }: { store: Store; slug: string }) {
    const t = useT();
    const locale = useLocale();
    return (
        <Link
            to="/$tenant/store/$storeId"
            params={{ tenant: slug, storeId: s.id }}
            className="block rounded-2xl bg-white p-4 space-y-3 active:scale-[0.99]"
        >
            <div className="flex items-center justify-between gap-2">
                <p className="truncate text-lg font-bold text-gray-900">{s.name}</p>
                <OpenBadge store={s} />
            </div>
            {s.sellers?.length ? (
                <Sellers sellers={s.sellers} />
            ) : s.open ? (
                // An API without `sellers` yet: the seller on shift, as one row.
                <Sellers
                    sellers={[
                        {
                            userId: `${s.id}-seller`,
                            name: s.sellerName ?? "",
                            avatarUrl: s.sellerAvatar,
                            cups: s.cups,
                        },
                    ]}
                />
            ) : (
                <p className="text-sm text-gray-900">{closedLine(s, t, locale)}</p>
            )}
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

/** `Closed 21:04 yesterday`, or `Not opened yet`. */
export function closedLine(
    s: Store,
    t: ReturnType<typeof useT>,
    locale: ReturnType<typeof useLocale>,
): string {
    return s.lastClosed
        ? t("store.closedAt").replace(
              "{when}",
              `${formatTime(s.lastClosed, locale)} ${formatDay(s.lastClosed, locale).toLowerCase()}`,
          )
        : t("store.notOpened");
}
