import { formatRelative } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { ChoiceList } from "@tea-pos/ui/ChoiceList";
import { FilterButton } from "@tea-pos/ui/FilterButton";
import { Pill } from "@tea-pos/ui/Pill";
import { SearchBox } from "@tea-pos/ui/SearchBox";
import { Sheet } from "@tea-pos/ui/Sheet";
import { useTenant } from "@tea-pos/shell/tenant";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useUac, type Person } from "./uac";

type Filter = "all" | "seller" | "admin" | "guest" | "none" | "inactive";

const FILTERS: Record<Filter, (p: Person) => boolean> = {
    all: () => true,
    seller: (p) => p.active && (p.owner || p.access.seller !== ""),
    admin: (p) => p.active && (p.owner || p.access.backoffice === "admin"),
    guest: (p) => p.active && p.access.backoffice === "guest",
    none: (p) => p.active && !p.owner && !p.access.seller && !p.access.backoffice,
    inactive: (p) => !p.active,
};

const FILTER_KEYS: Record<Filter, MessageKey> = {
    all: "uac.filterAll",
    seller: "uac.filterSeller",
    admin: "uac.filterAdmin",
    guest: "uac.filterGuest",
    none: "uac.filterNone",
    inactive: "uac.filterInactive",
};

/**
 * UAC's home, as the old Staff Payroll Info list: requests waiting on top, then everyone A to Z,
 * searchable and filtered; each row says what the person reaches in each app.
 */
export function UacHome() {
    const t = useT();
    const locale = useLocale();
    const navigate = useNavigate();
    const slug = useTenant()?.tenant.slug ?? "";
    const { data } = useUac();
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [filtering, setFiltering] = useState(false);
    const q = search.trim().toLowerCase();
    const people = (data?.people ?? [])
        .filter((p) => FILTERS[filter](p) && (!q || p.name.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name, locale));
    return (
        <div className="space-y-3">
            {data && data.requests.length > 0 && (
                <section className="space-y-2">
                    <p className="pl-3 text-xs font-bold uppercase tracking-widest text-gray-700">
                        {t("uac.waiting")} ({data.requests.length})
                    </p>
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
                                leading={<Avatar url={r.avatarUrl} square />}
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
                    active={filter !== "all"}
                    label={t("uac.filter")}
                    onClick={() => setFiltering(true)}
                />
            </div>
            <ListCard>
                {!data ? (
                    [1, 2, 3].map((i) => <ListRowSkeleton key={i} withLeading />)
                ) : people.length === 0 ? (
                    <p className="py-4 text-sm text-gray-400">{t("uac.noPeople")}</p>
                ) : (
                    people.map((p) => (
                        <ListRow
                            key={p.id}
                            onClick={() =>
                                void navigate({
                                    to: "/$tenant/uac/$userId",
                                    params: { tenant: slug, userId: p.id },
                                })
                            }
                            leading={<Avatar url={p.avatarUrl} square />}
                            title={p.name}
                            subtitle={<Pills person={p} />}
                        />
                    ))
                )}
            </ListCard>
            <Sheet open={filtering} onClose={() => setFiltering(false)} title={t("uac.filter")}>
                <div className="-mx-4">
                    <ChoiceList
                        value={filter}
                        onChange={(f) => {
                            setFilter(f);
                            setFiltering(false);
                        }}
                        choices={(Object.keys(FILTERS) as Filter[]).map((f) => ({
                            value: f,
                            label: t(FILTER_KEYS[f]),
                        }))}
                    />
                </div>
            </Sheet>
        </div>
    );
}

/** What someone reaches, one pill per app with its level: `Seller · Member`, `Office · Admin`. */
function Pills({ person: p }: { person: Person }) {
    const t = useT();
    const level = (l: string) => t(`uac.${l}` as MessageKey);
    if (!p.active) return <Pill>{t("uac.inactive")}</Pill>;
    if (p.owner) return <Pill>{t("uac.owner")}</Pill>;
    if (!p.access.seller && !p.access.backoffice) return <Pill>{t("uac.noAccess")}</Pill>;
    return (
        <span className="flex flex-wrap gap-1.5 pt-1">
            {p.access.seller && (
                <Pill>
                    {t("uac.seller")} · {level(p.access.seller)}
                </Pill>
            )}
            {p.access.backoffice && (
                <Pill>
                    {t("uac.office")} · {level(p.access.backoffice)}
                </Pill>
            )}
        </span>
    );
}
