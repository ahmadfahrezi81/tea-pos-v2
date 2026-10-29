import { useMe } from "@tea-pos/api-client/me";
import { useMaintenance } from "@tea-pos/api-client/status";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import type { MessageKey } from "@tea-pos/i18n";
import { ToastHost } from "@tea-pos/ui/toast";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

import { avatar } from "./avatar";
import { BootScreen } from "./BootScreen";
import { MobileShell } from "./MobileShell";
import type { Tab } from "./routes";
import { TenantProvider, useSlug } from "./tenant";
import { LATEST, seen } from "./whatsNew";
import { hideSplash } from "./splash";
import { useHasPainted } from "./useHasPainted";
import { useMeSync } from "./useMeSync";

/** One of an app's own tabs, under the tenant (`""` is the tenant's first screen); More is added last. */
export interface AppTab {
    path: string;
    labelKey: MessageKey;
    icon: LucideIcon;
    /** Other screens (under the tenant) that light this tab up. */
    also?: string[];
    /** Its other face inside part of the app (seller's POS shows as Manage in manage). */
    variant?: { path: string; labelKey: MessageKey; icon: LucideIcon };
}

/** The layout route every app's screens sit in, with the app's tabs. */
function ShellLayout({ tabs }: { tabs: AppTab[] }) {
    // Ready once /me is known (saved on the phone or answered) and the shell has painted under the splash.
    const me = useMe();
    useMeSync(me.data);
    const painted = useHasPainted();
    const ready = painted && (me.data !== undefined || me.isError);
    useEffect(() => {
        if (!ready) return;
        // For app_ready (events.ts): drawn from the phone's copy when that copy is older than this load.
        globalThis.__readyMe ??=
            me.dataUpdatedAt > 0 && me.dataUpdatedAt < performance.timeOrigin ? "saved" : "network";
        hideSplash();
    }, [ready, me.dataUpdatedAt]);
    const maintenance = useMaintenanceWatch(me.refetch);
    return (
        <TenantProvider me={me.data}>
            <Frame tabs={tabs} ready={ready} avatarUrl={me.data?.user.avatarUrl} />
            {maintenance && <BootScreen state="maintenance" />}
            <ToastHost />
        </TenantProvider>
    );
}

/** The app's tabs and More, under the tenant in the address. */
function Frame({
    tabs: own,
    ready,
    avatarUrl,
}: {
    tabs: AppTab[];
    ready: boolean;
    avatarUrl?: string;
}) {
    const slug = useSlug();
    const navigate = useNavigate();
    const unseen = LATEST !== "" && seen() !== LATEST;
    const root = slug ? `/${slug}` : "/";
    const under = (path: string) => (path ? `${root}/${path}` : root);
    const tabs: Tab[] = slug
        ? [
              ...own.map((t) => ({
                  path: under(t.path),
                  labelKey: t.labelKey,
                  icon: t.icon,
                  matchPaths: [t.path, ...(t.also ?? [])].map(under),
                  variant: t.variant && { ...t.variant, pathContains: under(t.variant.path) },
              })),
              {
                  path: `${root}/more`,
                  labelKey: unseen ? "nav.moreNew" : "nav.more",
                  icon: MoreHorizontal,
                  matchPaths: [`${root}/more`],
              },
          ]
        : [];
    const home = tabs[0]?.path ?? "/";
    return (
        <MobileShell
            rootTabPaths={tabs.map((t) => t.path)}
            tabs={tabs}
            homePath={home}
            avatarUrl={avatarUrl ? avatar(avatarUrl) : null}
            onAccount={slug ? () => void navigate({ to: `${root}/account` }) : undefined}
            ready={ready}
        />
    );
}

/** How often the maintenance screen asks whether it is over. */
const MAINTENANCE_RETRY_MS = 15_000;

/** While Go answers "maintenance", ask again every few seconds; once over, reload every screen's data. */
function useMaintenanceWatch(retry: () => unknown): boolean {
    const maintenance = useMaintenance();
    const queryClient = useQueryClient();
    const was = useRef(false);
    useEffect(() => {
        if (maintenance) {
            was.current = true;
            const handle = setInterval(retry, MAINTENANCE_RETRY_MS);
            return () => clearInterval(handle);
        }
        if (was.current) {
            was.current = false;
            void queryClient.invalidateQueries();
        }
    }, [maintenance, retry, queryClient]);
    return maintenance;
}

/** The options for each app's `/_shell` route, with its tabs. */
export const shellRoute = (tabs: AppTab[]) => ({
    component: () => <ShellLayout tabs={tabs} />,
    staticData: { holdsSplash: true },
});
