import { useT } from "@tea-pos/i18n/react";
import { Switch } from "@tea-pos/ui/form/Switch";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { pushOn, pushSupported, turnPushOff, turnPushOn } from "../lib/push";
import { rowIcon, SettingsGroup, SettingsRow } from "./Settings";

/** More's Notifications: this phone's push for chat, on or off (RFC: Chat (v2), screen 9). */
export function PushRow() {
    const t = useT();
    const [on, setOn] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        void pushOn().then(setOn);
    }, []);
    if (!pushSupported()) return null;
    const blocked = typeof Notification !== "undefined" && Notification.permission === "denied";
    return (
        <SettingsGroup title={t("shell.notifications")}>
            <SettingsRow
                icon={<Bell {...rowIcon} />}
                label={t("shell.chatNotifications")}
                sublabel={t(
                    blocked
                        ? "shell.notificationsBlocked"
                        : on
                          ? "shell.onThisPhone"
                          : "shell.offThisPhone",
                )}
                right={
                    <Switch
                        on={!!on}
                        label={t("shell.chatNotifications")}
                        onChange={(want) => {
                            if (busy || blocked) return;
                            setBusy(true);
                            void (want ? turnPushOn() : turnPushOff().then(() => false))
                                .then((now) => setOn(!!now))
                                .catch(() => setOn(false))
                                .finally(() => setBusy(false));
                        }}
                    />
                }
            />
        </SettingsGroup>
    );
}
