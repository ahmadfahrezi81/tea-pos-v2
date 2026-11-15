import { useT } from "@tea-pos/i18n/react";
import { useAccess } from "@tea-pos/shell/tenant";
import { Eye, X } from "lucide-react";
import { useSyncExternalStore } from "react";

import type { Gate } from "./home";

// One switch for POS and Manage, for this tab only; off again on reload.
let on = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
    on = v;
    listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

/**
 * The owner looking past the POS gate, to see and try the screens behind it. Look only: Go refuses
 * every write there (the day is someone else's, closed, or not open). Not offered on a day with
 * nobody on it, where the owner can simply open the store.
 */
export function useLookOnly(gate: Gate | undefined, mine: boolean) {
    const { owner } = useAccess();
    const looking = useSyncExternalStore(subscribe, () => on);
    const offered = owner && !!gate && !mine && gate.gate !== "no_session";
    return { offered, looking: offered && looking, start: () => set(true), stop: () => set(false) };
}

/** Under the gate's card: the owner's way past it. */
export function LookAnyway({ onClick }: { onClick: () => void }) {
    const t = useT();
    return (
        <button
            onClick={onClick}
            className="mx-auto flex items-center gap-1.5 py-2 text-sm font-semibold text-brand active:opacity-60"
        >
            <Eye size={16} strokeWidth={2.5} />
            {t("gate.lookAnyway")}
        </button>
    );
}

/** While looking: says nothing is saved, and goes back to the gate. */
export function LookOnlyBanner({ onClose }: { onClose: () => void }) {
    const t = useT();
    return (
        <div className="flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900">
            <Eye size={16} strokeWidth={2.5} className="shrink-0" />
            <span className="flex-1">{t("gate.lookOnly")}</span>
            <button onClick={onClose} className="p-1 -mr-1 active:opacity-60" aria-label="×">
                <X size={16} strokeWidth={2.5} />
            </button>
        </div>
    );
}
