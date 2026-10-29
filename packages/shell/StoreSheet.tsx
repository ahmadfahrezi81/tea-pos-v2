import { useT } from "@tea-pos/i18n/react";
import { Switch } from "@tea-pos/ui/form/Switch";
import { Sheet } from "@tea-pos/ui/Sheet";
import { Check, Eye, EyeOff } from "lucide-react";

import { useApp } from "./AppContext";
import { useTenant } from "./tenant";

/** The old apps' store sheet: the eye switch hides demo and inactive stores (backoffice). */
export default function StoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const t = useT();
    const { stores: mode } = useApp();
    const state = useTenant();
    if (!state) return null;
    const { tenant, stores, store, setStore, hideInactive, setHideInactive } = state;
    const hideable = mode === "all" && tenant.stores.some((s) => s.status !== "active");
    const options = [
        ...(mode === "all" ? [{ id: null, name: t("shell.allStores"), status: "active" }] : []),
        ...stores.filter((s) => mode === "all" || s.status === "active"),
    ];
    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={t("shell.pickStore")}
            beside={
                hideable && (
                    <Switch
                        on={hideInactive}
                        onChange={setHideInactive}
                        label={t("shell.hideInactiveStores")}
                        icon={
                            hideInactive ? (
                                <EyeOff size={16} className="text-brand" />
                            ) : (
                                <Eye size={16} className="text-gray-400" />
                            )
                        }
                    />
                )
            }
        >
            <div className="space-y-3">
                {options.map((option, i) => {
                    const picked = (store?.id ?? null) === option.id;
                    return (
                        <button
                            key={option.id ?? "all"}
                            onClick={() => {
                                setStore(option.id);
                                onClose();
                            }}
                            className={`w-full flex items-center justify-between py-5 ${
                                i < options.length - 1 ? "border-b" : ""
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span
                                    className={`text-lg text-gray-900 truncate ${option.id === null ? "font-semibold" : ""}`}
                                >
                                    {option.name}
                                </span>
                                {option.status === "fake" && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 mt-0.5 rounded bg-red-100 text-red-600">
                                        {t("shell.demo")}
                                    </span>
                                )}
                                {option.status === "inactive" && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 mt-0.5 rounded bg-gray-100 text-gray-500">
                                        {t("shell.inactive")}
                                    </span>
                                )}
                            </div>
                            <span
                                className={`size-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                    picked ? "border-brand/90 bg-brand/90" : "border-gray-300"
                                }`}
                            >
                                {picked && (
                                    <Check size={16} className="text-white" strokeWidth={4} />
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </Sheet>
    );
}
