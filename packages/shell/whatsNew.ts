import type { Locale } from "@tea-pos/i18n";

declare const __WHATS_NEW_LATEST__: string;

/** One release's "For users" lines (the release skill writes whats-new.json). */
export interface WhatsNewEntry {
    /** The release's version, e.g. 2026.11.1: newest first in the file. */
    version: string;
    date: string;
    apps: string[];
    lines: Record<Locale, string[]>;
}

const SEEN_KEY = "tea-pos:whats-new-seen";

/** The newest entry for this app, built in (vite.ts), so the dot costs no download. */
export const LATEST = __WHATS_NEW_LATEST__;

export function seen(): string {
    try {
        return localStorage.getItem(SEEN_KEY) ?? "";
    } catch {
        return LATEST;
    }
}

export function markSeen() {
    try {
        localStorage.setItem(SEEN_KEY, LATEST);
    } catch {
        // No storage: the dot comes back next open.
    }
}

/** The entries themselves, loaded only when the screen opens. */
export async function loadWhatsNew(app: string): Promise<WhatsNewEntry[]> {
    const { default: all } = await import("./whats-new.json");
    return (all as WhatsNewEntry[]).filter((e) => e.apps.includes(app));
}
