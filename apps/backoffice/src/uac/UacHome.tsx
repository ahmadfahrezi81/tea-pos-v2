import { formatRelative } from "@tea-pos/format";
import type { MessageKey } from "@tea-pos/i18n";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { avatar } from "@tea-pos/shell/avatar";
import { useTenant } from "@tea-pos/shell/tenant";
import { Link } from "@tanstack/react-router";
import { ChevronRight, UserCircle } from "lucide-react";

import { useUac, type Person } from "./uac";

/** UAC's home: requests waiting on top, then everyone, with what each can reach. */
export function UacHome() {
    const t = useT();
    const locale = useLocale();
    const slug = useTenant()?.tenant.slug ?? "";
    const { data } = useUac();
    if (!data)
        return (
            <div className="space-y-3">
                <div className="h-40 rounded-2xl bg-white" />
            </div>
        );
    return (
        <div className="space-y-4">
            {data.requests.length > 0 && (
                <section className="space-y-2">
                    <p className="px-1 text-sm font-semibold text-gray-500">
                        {t("uac.waiting")} ({data.requests.length})
                    </p>
                    <div className="overflow-hidden rounded-2xl bg-white">
                        {data.requests.map((r, i) => (
                            <Link
                                key={r.id}
                                to="/$tenant/uac/requests/$id"
                                params={{ tenant: slug, id: r.id }}
                                className="block active:bg-gray-50"
                            >
                                <Row
                                    name={r.name}
                                    avatarUrl={r.avatarUrl}
                                    line={t("uac.askedAt").replace(
                                        "{when}",
                                        formatRelative(r.at, locale),
                                    )}
                                    last={i === data.requests.length - 1}
                                    arrow
                                />
                            </Link>
                        ))}
                    </div>
                </section>
            )}
            <section className="space-y-2">
                <p className="px-1 text-sm font-semibold text-gray-500">
                    {t("uac.people")} ({data.people.length})
                </p>
                <div className="overflow-hidden rounded-2xl bg-white">
                    {data.people.length === 0 && (
                        <p className="p-6 text-center text-gray-400">{t("uac.noPeople")}</p>
                    )}
                    {data.people.map((p, i) => (
                        <Link
                            key={p.id}
                            to="/$tenant/uac/$userId"
                            params={{ tenant: slug, userId: p.id }}
                            className="block active:bg-gray-50"
                        >
                            <Row
                                name={p.name}
                                avatarUrl={p.avatarUrl}
                                line={summary(p, t)}
                                last={i === data.people.length - 1}
                                arrow
                            />
                        </Link>
                    ))}
                </div>
            </section>
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

function Row({
    name,
    avatarUrl,
    line,
    last,
    arrow,
}: {
    name: string;
    avatarUrl?: string;
    line: string;
    last: boolean;
    arrow?: boolean;
}) {
    return (
        <div className={`flex items-center gap-3 p-3 ${last ? "" : "border-b border-gray-100"}`}>
            {avatarUrl ? (
                <img
                    src={avatar(avatarUrl)}
                    alt=""
                    width={36}
                    height={36}
                    referrerPolicy="no-referrer"
                    className="size-9 shrink-0 rounded-full object-cover"
                />
            ) : (
                <UserCircle size={36} className="shrink-0 text-gray-400" />
            )}
            <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gray-900">{name}</p>
                <p className="truncate text-xs text-gray-500">{line}</p>
            </div>
            {arrow && <ChevronRight size={20} className="shrink-0 text-gray-400" />}
        </div>
    );
}
