import { formatMoney, formatRelative } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { FilterButton } from "@tea-pos/ui/FilterButton";
import { Badge } from "@tea-pos/ui/Badge";
import { SearchBox } from "@tea-pos/ui/SearchBox";
import { rowIcon, SettingsGroup, SettingsRow } from "@tea-pos/shell/Settings";
import { useSearchParam, useSearchText, useSetSearch } from "@tea-pos/shell/searchParam";
import { useSlug } from "@tea-pos/shell/tenant";
import { useNavigate } from "@tanstack/react-router";
import { CircleHelp } from "lucide-react";
import { useState } from "react";

import {
    isFiltered,
    matches,
    NO_FILTER,
    PeopleFilterSheet,
    type PeopleFilter,
} from "./PeopleFilter";
import { useUac, type Person } from "./uac";
import { EmptyState } from "@tea-pos/ui/EmptyState";
import { SectionLabel } from "@tea-pos/ui/SectionLabel";

/**
 * UAC's home, as the old Staff Payroll Info list: requests waiting on top, then everyone by importance and A to Z,
 * searchable and filtered by app and level; each row says what the person reaches in each app;
 * How access works at the bottom.
 */
export function UacHome() {
    const t = useT();
    const locale = useLocale();
    const navigate = useNavigate();
    const slug = useSlug();
    const { data } = useUac();
    const [search, setSearch] = useSearchText();
    const [seller] = useSearchParam("seller");
    const [office] = useSearchParam("office");
    const [inactive] = useSearchParam("inactive");
    const setSearchParams = useSetSearch();
    // In the address '' is "any"; no access is spelt `none`.
    const level = (v: string, any: string) => (v === "none" ? "" : v || any);
    const filter: PeopleFilter = {
        seller: level(seller, NO_FILTER.seller) as PeopleFilter["seller"],
        backoffice: level(office, NO_FILTER.backoffice) as PeopleFilter["backoffice"],
        inactive: inactive === "1",
    };
    const setFilter = (f: PeopleFilter) =>
        setSearchParams({
            seller: f.seller === "any" ? "" : f.seller || "none",
            office: f.backoffice === "any" ? "" : f.backoffice || "none",
            inactive: f.inactive ? "1" : "",
        });
    const [filtering, setFiltering] = useState(false);
    const q = search.trim().toLowerCase();
    const people = (data?.people ?? [])
        .filter((p) => matches(filter, p) && (!q || p.name.toLowerCase().includes(q)))
        .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, locale));
    return (
        <div className="space-y-3">
            {data && data.requests.length > 0 && (
                <section className="space-y-2">
                    <SectionLabel>
                        {t("uac.waiting")} ({data.requests.length})
                    </SectionLabel>
                    <ListCard>
                        {data.requests.map((r) => (
                            <ListRow
                                key={r.id}
                                onClick={() =>
                                    void navigate({
                                        to: "/$tenant/uac/requests/$id",
                                        params: { tenant: slug, id: r.id },
                                    })
                                }
                                leading={<Avatar url={r.avatarUrl} />}
                                title={r.name}
                                subtitle={t("uac.askedAt").replace(
                                    "{when}",
                                    formatRelative(r.at, locale),
                                )}
                            />
                        ))}
                    </ListCard>
                </section>
            )}
            <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                    <SearchBox
                        value={search}
                        onChange={setSearch}
                        placeholder={t("uac.search")}
                        clearLabel={t("common.close")}
                    />
                </div>
                <FilterButton
                    active={isFiltered(filter)}
                    label={t("uac.filter")}
                    onClick={() => setFiltering(true)}
                />
            </div>
            {data && people.length === 0 ? (
                q || isFiltered(filter) ? (
                    <EmptyState title={t("uac.noMatch")} body={t("uac.noMatchBody")} />
                ) : (
                    <EmptyState title={t("uac.noPeople")} />
                )
            ) : (
                <ListCard>
                    {!data
                        ? [1, 2, 3].map((i) => <ListRowSkeleton key={i} withLeading />)
                        : people.map((p) => (
                              <ListRow
                                  key={p.id}
                                  onClick={() =>
                                      void navigate({
                                          to: "/$tenant/uac/$userId",
                                          params: { tenant: slug, userId: p.id },
                                      })
                                  }
                                  leading={<Avatar url={p.avatarUrl} />}
                                  top
                                  title={p.name}
                                  subtitle={<Badges person={p} />}
                              />
                          ))}
                </ListCard>
            )}
            <SettingsGroup>
                <SettingsRow
                    to={`/${slug}/uac/help`}
                    icon={<CircleHelp {...rowIcon} />}
                    label={t("uac.helpTitle")}
                />
            </SettingsGroup>
            <PeopleFilterSheet
                open={filtering}
                value={filter}
                onChange={setFilter}
                onClose={() => setFiltering(false)}
            />
        </div>
    );
}

/** Most responsibility first: the owner, admins, office guests, sellers, then the rest. */
function rank(p: Person): number {
    if (!p.active) return 5;
    if (p.owner) return 0;
    if (p.access.backoffice === "admin") return 1;
    if (p.access.backoffice === "guest") return 2;
    return p.access.seller ? 3 : 4;
}

/** What someone reaches, one badge per app with its level: `Seller · Member`, `Office · Admin`. */
function Badges({ person: p }: { person: Person }) {
    const t = useT();
    const level = (l: string) => t(`uac.${l}` as MessageKey);
    if (!p.active) return <Badge>{t("uac.inactive")}</Badge>;
    const count = (n: number, one: MessageKey, many: MessageKey) =>
        t(n === 1 ? one : many).replace("{n}", String(n));
    const glance = [
        count(p.storeIds.length, "uac.oneStore", "uac.nStores"),
        ...(p.commissionRate > 0
            ? [t("uac.perCup").replace("{rate}", formatMoney(p.commissionRate))]
            : []),
        count(p.claimTypeIds.length, "uac.oneClaim", "uac.nClaims"),
    ].join(" · ");
    return (
        <span className="block space-y-1 pt-1">
            <span className="flex flex-wrap gap-1.5">
                {p.owner && <Badge>{t("uac.owner")}</Badge>}
                {!p.owner && !p.access.seller && !p.access.backoffice && (
                    <Badge>{t("uac.noAccess")}</Badge>
                )}
                {!p.owner && p.access.seller && (
                    <Badge>
                        {t("uac.seller")} · {level(p.access.seller)}
                    </Badge>
                )}
                {!p.owner && p.access.backoffice && (
                    <Badge>
                        {t("uac.office")} · {level(p.access.backoffice)}
                    </Badge>
                )}
            </span>
            <span className="block text-xs text-gray-900">{glance}</span>
        </span>
    );
}
