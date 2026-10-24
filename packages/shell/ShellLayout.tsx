import { useMe } from "@tea-pos/api-client/me";
import { useMaintenance } from "@tea-pos/api-client/status";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { BootScreen } from "./BootScreen";
import { MobileShell } from "./MobileShell";
import { hideSplash } from "./splash";
import { useHasPainted } from "./useHasPainted";
import { useMeSync } from "./useMeSync";

/** The layout route every app's screens sit in. Tabs arrive with later steps. */
export function ShellLayout() {
    // Ready once /me is known (saved on the phone or answered) and the shell has painted under the splash.
    const me = useMe();
    useMeSync(me.data);
    const painted = useHasPainted();
    const ready = painted && (me.data !== undefined || me.isError);
    useEffect(() => {
        if (ready) hideSplash();
    }, [ready]);
    const maintenance = useMaintenanceWatch(me.refetch);
    return (
        <>
            <MobileShell rootTabPaths={["/"]} tabs={[]} homePath="/" ready={ready} />
            {maintenance && <BootScreen state="maintenance" />}
        </>
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

/** The options for each app's `/_shell` route. */
export const shellRoute = { component: ShellLayout, staticData: { holdsSplash: true } };
