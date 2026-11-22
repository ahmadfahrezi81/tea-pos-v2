import { PushNotOn, pushState, turnPushOn, type PushState } from "@tea-pos/api-client/chat";
import { showPermissionHelp } from "@tea-pos/ui/permissions";
import { useState } from "react";

import { reportError } from "../lib/events";

/**
 * Turn on, for the Chats card and Account → Permissions. When the phone does not say yes, the
 * help sheet says where to allow them, and the reason goes to PostHog (task 077).
 */
export function useTurnPushOn(onState: (s: PushState) => void) {
    const [busy, setBusy] = useState(false);
    const turnOn = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await turnPushOn();
        } catch (e) {
            reportError(e);
            showPermissionHelp("notifications", e instanceof PushNotOn ? e.reason : "failed");
        }
        onState(await pushState());
        setBusy(false);
    };
    return { turnOn, busy };
}
