import { useT } from "@tea-pos/i18n/react";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import { useApp } from "./AppContext";
import { useTenant } from "./tenant";

/** The header's store name; a tap opens the list (both apps: one store in seller, also All stores in backoffice). */
export function StorePicker() {
    const t = useT();
    const { stores: mode } = useApp();
    const state = useTenant();
    const [open, setOpen] = useState(false);
    if (!state || state.tenant.stores.length < (mode === "all" ? 1 : 2)) {
        return state?.store ? (
            <span className="text-sm text-gray-500 truncate">{state.store.name}</span>
        ) : null;
    }
    const { stores, store, setStore, hideInactive, setHideInactive } = state;
    const pick = (id: string | null) => {
        setStore(id);
        setOpen(false);
    };
    const row = (id: string | null, label: string, muted = false) => (
        <li key={id ?? "all"}>
            <button
                onClick={() => pick(id)}
                className={`w-full flex items-center justify-between py-3 text-left ${muted ? "text-gray-400" : "text-gray-900"}`}
            >
                <span className="truncate">{label}</span>
                {(store?.id ?? null) === id && <Check size={18} className="text-brand shrink-0" />}
            </button>
        </li>
    );

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1 text-sm text-gray-600 min-w-0"
            >
                <span className="truncate">{store?.name ?? t("shell.allStores")}</span>
                <ChevronDown size={16} className="shrink-0" />
            </button>
            {open &&
                // Into the page body: the header is its own layer, which would trap a fixed sheet.
                createPortal(
                    <div
                        className="fixed inset-0 z-50 flex items-end bg-black/40"
                        onClick={() => setOpen(false)}
                    >
                        <div
                            className="w-full max-h-[70vh] overflow-y-auto bg-white rounded-t-2xl p-5 pb-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="font-bold text-gray-900 mb-2">{t("shell.pickStore")}</p>
                            <ul className="divide-y divide-gray-100">
                                {mode === "all" && row(null, t("shell.allStores"))}
                                {stores.map((s) =>
                                    mode === "one" && s.status !== "active"
                                        ? null
                                        : row(s.id, s.name, s.status !== "active"),
                                )}
                            </ul>
                            {mode === "all" && (
                                <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={hideInactive}
                                        onChange={(e) => setHideInactive(e.target.checked)}
                                    />
                                    {t("shell.hideInactiveStores")}
                                </label>
                            )}
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}
