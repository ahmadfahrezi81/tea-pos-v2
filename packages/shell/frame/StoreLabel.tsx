import { useT } from "@tea-pos/i18n/react";
import type { StoreChoice } from "@tea-pos/ui/DateRangeSheet";
import { PickerRow } from "@tea-pos/ui/PickerButton";
import { Store } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { useApp } from "../session/AppContext";
import { useTenant } from "../session/tenant";

// The sheet loads on the first tap: nothing of it is needed to draw the label.
const StoreSheet = lazy(() => import("./StoreSheet"));

/**
 * Which store the screen is about, as a picker card's row: most people work in one store, so it is
 * only its name; with more than one to pick from it gets a chevron and a tap opens the store sheet.
 */
export function StoreLabel({
    detail,
}: {
    /** Under the name; by default the store's opening hours. */
    detail?: string;
}) {
    const t = useT();
    const { stores: mode } = useApp();
    const state = useTenant();
    const [open, setOpen] = useState(false);
    const [opened, setOpened] = useState(false);
    if (!state || (mode === "one" && !state.store)) return null;
    const choices = mode === "all" ? 2 : state.stores.filter((s) => s.status !== "inactive").length;
    const pickable = choices > 1;
    const name = state.store?.name ?? t("shell.allStores");
    const show = () => {
        setOpened(true);
        setOpen(true);
    };
    const sheet = opened && (
        <Suspense>
            <StoreSheet open={open} onClose={() => setOpen(false)} />
        </Suspense>
    );
    const s = state.store;
    return (
        <>
            <PickerRow
                label={name}
                icon={Store}
                brand
                detail={
                    detail ??
                    (s?.openTime && s.closeTime ? `${s.openTime} – ${s.closeTime}` : undefined)
                }
                onClick={pickable ? show : undefined}
            />
            {sheet}
        </>
    );
}

/** A store as a picker's option: a demo or closed one (shown only when chosen) says so. */
export function storeOption(
    s: { id: string; name: string; status: string },
    t: ReturnType<typeof useT>,
) {
    const badge =
        s.status === "fake"
            ? t("shell.demo")
            : s.status === "inactive"
              ? t("shell.inactive")
              : undefined;
    return { id: s.id, name: s.name, badge };
}

/**
 * The screen's store for a date sheet's Store and Date menu (`DateRangeSheet`'s `store`): the stores
 * the store sheet offers (the backoffice's All stores first), the one picked, and picking one.
 */
export function useStoreChoice(dateLabel: string): StoreChoice | undefined {
    const t = useT();
    const { stores: mode } = useApp();
    const state = useTenant();
    if (!state) return undefined;
    return {
        menuTitle: t("shell.storeAndDate"),
        label: t("shell.store"),
        dateLabel,
        options: [
            ...(mode === "all" ? [{ id: null, name: t("shell.allStores") }] : []),
            ...state.stores
                .filter((s) => mode === "all" || s.status !== "inactive")
                .map((s) => storeOption(s, t)),
        ],
        picked: state.store?.id ?? null,
        onPick: state.setStore,
    };
}
