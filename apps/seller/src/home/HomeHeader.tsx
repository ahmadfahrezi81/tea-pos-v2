import { formatCalendarDay, localDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useSlug } from "@tea-pos/shell/tenant";
import { Link, useLocation } from "@tanstack/react-router";

/** The top of POS and Manage: today, and the switch between them, as v1. At a Glance joins it. */
export function HomeHeader() {
    const t = useT();
    const locale = useLocale();
    const slug = useSlug();
    const path = useLocation({ select: (l) => l.pathname });
    const onManage = path.endsWith("/manage");
    const pill = (active: boolean) =>
        `px-3.5 py-0.5 rounded-lg text-lg font-semibold transition-all duration-200 ${active ? "bg-white text-slate-950" : "text-slate-600"}`;
    return (
        <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900 truncate">
                {formatCalendarDay(localDate(), locale, "short")}
            </p>
            <div className="flex items-center bg-slate-200 rounded-xl p-1">
                <Link
                    to="/$tenant/pos"
                    params={{ tenant: slug }}
                    replace
                    className={pill(!onManage)}
                >
                    {t("nav.pos")}
                </Link>
                <Link
                    to="/$tenant/manage"
                    params={{ tenant: slug }}
                    replace
                    className={pill(onManage)}
                >
                    {t("nav.manage")}
                </Link>
            </div>
        </div>
    );
}
