import { useT } from "@tea-pos/i18n/react";
import { useTenant } from "@tea-pos/shell/tenant";
import { Store } from "lucide-react";

/** The stores this person works at. */
export function MyStores() {
    const t = useT();
    const stores = useTenant()?.tenant.stores ?? [];
    return (
        <div className="bg-white rounded-2xl divide-y divide-slate-100">
            {stores.length === 0 ? (
                <p className="px-4 py-5 text-sm text-gray-400">{t("more.noStores")}</p>
            ) : (
                stores.map((store) => (
                    <div key={store.id} className="flex items-center gap-3 px-4 py-4">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                            <Store size={16} strokeWidth={2} className="text-gray-500" />
                        </div>
                        <p className="flex-1 text-[15px] font-medium text-gray-800">{store.name}</p>
                    </div>
                ))
            )}
        </div>
    );
}
