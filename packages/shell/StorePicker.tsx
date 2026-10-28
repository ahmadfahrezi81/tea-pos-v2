import { useT } from "@tea-pos/i18n/react";
import { ChevronsUpDown } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { useApp } from "./AppContext";
import { useTenant } from "./tenant";

// The sheet loads on the first tap: nothing of it is needed to draw the header.
const StoreSheet = lazy(() => import("./StoreSheet"));

/**
 * The screen's store, at the top of the Store screens until each has its store in the path (Step 48):
 * its name large in the brand colour; a tap opens the sheet (seller: its stores; backoffice: All
 * Stores first, then each store).
 */
export function StorePicker() {
    const t = useT();
    const { stores: mode } = useApp();
    const state = useTenant();
    const [open, setOpen] = useState(false);
    const [opened, setOpened] = useState(false);
    if (!state || (mode === "one" && !state.store)) return null;
    const show = () => {
        setOpened(true);
        setOpen(true);
    };
    return (
        <>
            <button
                onClick={show}
                className="mb-3 flex min-w-0 max-w-full items-center gap-0.5 active:scale-95"
            >
                <span className="truncate text-[22px] font-semibold tracking-tight text-brand">
                    {state.store?.name ?? t("shell.allStores")}
                </span>
                <ChevronsUpDown size={18} strokeWidth={3} className="shrink-0 text-brand" />
            </button>
            {opened && (
                <Suspense>
                    <StoreSheet open={open} onClose={() => setOpen(false)} />
                </Suspense>
            )}
        </>
    );
}
