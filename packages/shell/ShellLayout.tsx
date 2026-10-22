import { useEffect } from "react";

import { MobileShell } from "./MobileShell";
import { hideSplash } from "./splash";
import { useHasPainted } from "./useHasPainted";

/** The layout route every app's screens sit in. Tabs and `/me` arrive with later steps. */
export function ShellLayout() {
    // Until `/me` (Step 13), ready once the shell has painted under the splash.
    const ready = useHasPainted();
    useEffect(() => {
        if (ready) hideSplash();
    }, [ready]);
    return <MobileShell rootTabPaths={["/"]} tabs={[]} homePath="/" ready={ready} />;
}

/** The options for each app's `/_shell` route. */
export const shellRoute = { component: ShellLayout, staticData: { holdsSplash: true } };
