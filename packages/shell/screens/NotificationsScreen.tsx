import { pushState, turnPushOff, type PushState } from "@tea-pos/api-client/chat";
import { useT } from "@tea-pos/i18n/react";
import { Switch } from "@tea-pos/ui/form/Switch";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { rowIcon, SettingsRow } from "../frame/Settings";
import { useTurnPushOn } from "../session/push";

const SUBLABEL = {
    on: "account.onThisPhone",
    off: "account.offThisPhone",
    blocked: "account.notificationsBlocked",
    unsupported: "account.notificationsUnsupported",
} as const;

/**
 * Account → Notifications: this phone's chat notifications, on or off. Deep in the settings on
 * purpose (owner): turning them on is a card in Chats; here is where they are turned off.
 */
export function NotificationsScreen() {
    const t = useT();
    const [state, setState] = useState<PushState | null>(null);
    const [busy, setBusy] = useState(false);
    const on = useTurnPushOn(setState);
    useEffect(() => {
        void pushState().then(setState);
    }, []);
    return (
        <div className="bg-white rounded-2xl px-4 py-1">
            <SettingsRow
                icon={<Bell {...rowIcon} />}
                label={t("account.chatNotifications")}
                sublabel={state ? t(SUBLABEL[state]) : undefined}
                right={
                    state === "on" || state === "off" ? (
                        <Switch
                            on={state === "on"}
                            label={t("account.chatNotifications")}
                            onChange={(want) => {
                                if (want) return void on.turnOn();
                                if (busy) return;
                                setBusy(true);
                                void turnPushOff()
                                    .catch(() => {})
                                    .then(pushState)
                                    .then(setState)
                                    .finally(() => setBusy(false));
                            }}
                        />
                    ) : undefined
                }
            />
            {on.sheet}
        </div>
    );
}
