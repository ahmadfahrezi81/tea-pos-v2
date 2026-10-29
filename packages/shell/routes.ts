import type { MessageKey } from "@tea-pos/i18n";
import type { LucideIcon } from "lucide-react";

/**
 * What the shell needs to know about a route, set on the route itself as
 * `staticData: { shell: {...} }`. Every field is a layout capability, never a
 * specific screen; only `titleKey` and `parent` are required. A screen's header
 * buttons are its own (`<HeaderActions>`), not route data.
 */
export type ShellRoute = {
    titleKey: MessageKey;
    /** `null` marks a root tab; `"lastRootTab"` returns to the tab the user came from; else a path, or one relative to this screen (`..`). */
    parent: string | null | "lastRootTab";
    /** A full-width button in the footer, linking to `<route>/add`. */
    footerCtaKey?: MessageKey;
    /** Overrides the scroll region's bottom padding. */
    scrollPaddingBottom?: string;
    /** An X instead of back: a page you close (Account), as the old apps. */
    close?: boolean;
    /** Pull down at the top to refetch. Opt-in: a refetch can reset a form seeded from fetched data. */
    refreshable?: boolean;
};

declare module "@tanstack/react-router" {
    interface StaticDataRouteOption {
        shell?: ShellRoute;
        /** The splash stays until this route calls `hideSplash` itself (the shell waits for its data). */
        holdsSplash?: boolean;
    }
}

/** A route is a subpage exactly when it has somewhere to go back to. */
export const isSubPage = (route: ShellRoute | undefined): boolean =>
    route ? route.parent !== null : false;

export type Tab = {
    path: string;
    labelKey: MessageKey;
    icon: LucideIcon;
    matchPaths: string[];
    /** Swaps label and icon while on a matching path (POS presents as Manage inside manage). */
    variant?: {
        pathContains: string;
        labelKey: MessageKey;
        icon: LucideIcon;
    };
};
