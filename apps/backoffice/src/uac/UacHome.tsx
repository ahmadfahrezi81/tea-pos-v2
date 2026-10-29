import { formatRelative } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { ListCard, ListRow, ListRowSkeleton } from "@tea-pos/ui/ListRow";
import { SearchBox } from "@tea-pos/ui/SearchBox";
import { useTenant } from "@tea-pos/shell/tenant";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { useUac, type Person } from "./uac";

/** UAC's home, as the old Staff Payroll Info list: requests waiting on top, then everyone, searchable. */
export function UacHome() {
    const t = useT();
    const locale = useLocale();
    const navigate = useNavigate();
    const slug = useTenant()?.tenant.slug ?? "";
    const { data } = useUac();
    const [search, setSearch] = useState("");
    const q = search.trim().toLowerCase();
    const people = (data?.people ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
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
            <SearchBox
                value={search}
                onChange={setSearch}
                placeholder={t("uac.search")}
                clearLabel={t("common.close")}
            />
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
                            subtitle={summary(p, t)}
                        />
                    ))
                )}
            </ListCard>
        </div>
    );
}

/** `Seller · Admin`, `Owner`, `Inactive`: the apps someone reaches, in a few words. */
function summary(p: Person, t: (k: MessageKey) => string): string {
    if (!p.active) return t("uac.inactive");
    if (p.owner) return t("uac.owner");
    const parts = [];
    if (p.access.seller) parts.push(t("uac.seller"));
    if (p.access.backoffice)
        parts.push(
            `${t("uac.backoffice")} ${t(`uac.${p.access.backoffice}` as MessageKey).toLowerCase()}`,
        );
    return parts.length > 0 ? parts.join(" · ") : t("uac.noAccess");
}
