import { useMe } from "@tea-pos/api-client/me";
import { useEffect } from "react";

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
    return <MobileShell rootTabPaths={["/"]} tabs={[]} homePath="/" ready={ready} />;
}

/** The options for each app's `/_shell` route. */
export const shellRoute = { component: ShellLayout, staticData: { holdsSplash: true } };
