import { pushOn, pushSupported, turnPushOff, turnPushOn } from "@tea-pos/api-client/chat";
import { useT } from "@tea-pos/i18n/react";
import { Switch } from "@tea-pos/ui/form/Switch";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { rowIcon, SettingsRow } from "../frame/Settings";

/**
 * Account → Notifications: this phone's chat notifications, on or off. Deep in the settings on
 * purpose (owner): turning them on is a card in Chats; here is where they are turned off.
 */
export function NotificationsScreen() {
    const t = useT();
    const [on, setOn] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        void pushOn().then(setOn);
    }, []);
    const supported = pushSupported();
    const blocked = supported && Notification.permission === "denied";
    return (
        <div className="bg-white rounded-2xl px-4 py-1">
            <SettingsRow
                icon={<Bell {...rowIcon} />}
                label={t("account.chatNotifications")}
                sublabel={t(
                    !supported
                        ? "account.notificationsUnsupported"
                        : blocked
                          ? "account.notificationsBlocked"
                          : on
                            ? "account.onThisPhone"
                            : "account.offThisPhone",
                )}
                right={
                    supported && !blocked ? (
                        <Switch
                            on={!!on}
                            label={t("account.chatNotifications")}
                            onChange={(want) => {
                                if (busy) return;
                                setBusy(true);
                                void (want ? turnPushOn() : turnPushOff().then(() => false))
                                    .then((now) => setOn(!!now))
                                    .catch(() => setOn(false))
                                    .finally(() => setBusy(false));
                            }}
                        />
                    ) : undefined
                }
            />
        </div>
    );
}
