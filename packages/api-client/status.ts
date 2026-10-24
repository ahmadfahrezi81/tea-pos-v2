import { useSyncExternalStore } from "react";

declare const __APP_TAG__: string;

/** Sent as X-App-Version on every request: "seller@2026.10.3+a1b2c3d". Go logs it and may answer 426. */
export const APP_TAG = __APP_TAG__;

const tooOld = new Set<() => void>();

/** Go answered 426: this release is too old to be safe. The shell updates and reloads. */
export function onAppTooOld(fn: () => void): () => void {
    tooOld.add(fn);
    return () => tooOld.delete(fn);
}

export function appTooOld() {
    for (const fn of tooOld) fn();
}

let maintenance = false;
const listeners = new Set<() => void>();

/** Set by every API answer: 503 "maintenance" turns it on, any success off. */
export function setMaintenance(on: boolean) {
    if (on === maintenance) return;
    maintenance = on;
    for (const fn of listeners) fn();
}

export function useMaintenance(): boolean {
    return useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => maintenance,
    );
}
