import type { components } from "@tea-pos/api-client";
import { useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";

/** Who worked the day and the cups each sold; the same rows on the day's detail. */
export function Sellers({ sellers }: { sellers: components["schemas"]["DaySeller"][] }) {
    const t = useT();
    if (sellers.length === 0) return null;
    return (
        <div className="flex flex-col gap-1.5">
            {sellers.map((s) => (
                <div
                    key={s.userId}
                    className="flex items-center gap-2 bg-slate-100 rounded-xl p-1.5"
                >
                    <Avatar url={s.avatarUrl} size={28} square />
                    <p className="text-base font-bold text-gray-900 truncate flex-1">
                        {s.name || t("common.unknown")}
                    </p>
                    <span className="text-sm font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-lg shrink-0">
                        {s.cups} {t("store.cupsUnit")}
                    </span>
                </div>
            ))}
        </div>
    );
}
