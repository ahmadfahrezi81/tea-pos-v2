import { pushState, turnPushOff, type PushState } from "@tea-pos/api-client/chat";
import { useT } from "@tea-pos/i18n/react";
import { Switch } from "@tea-pos/ui/form/Switch";
import {
    askCamera,
    permissionState,
    showPermissionHelp,
    type PermissionState,
} from "@tea-pos/ui/permissions";
import { Bell, Camera } from "lucide-react";
import { useEffect, useState } from "react";

import { rowIcon, SettingsRow } from "../frame/Settings";
import { useTurnPushOn } from "../session/push";
import { useTenant } from "../session/tenant";

const SUBLABEL = {
    on: "account.onThisPhone",
    off: "account.offThisPhone",
    blocked: "account.notificationsBlocked",
    unsupported: "account.notificationsUnsupported",
} as const;

/**
 * Account → Permissions (task 077): what this phone allows the app, each in one row. Notifications
 * turn on in Chats and off here; a blocked one opens the help sheet with the steps.
 */
export function PermissionsScreen() {
    const t = useT();
    const hasChat = !!useTenant()?.tenant.access.chat;
    const [push, setPush] = useState<PushState | null>(null);
    const [camera, setCamera] = useState<PermissionState | null>(null);
    const [busy, setBusy] = useState(false);
    const on = useTurnPushOn(setPush);
    useEffect(() => {
        void pushState().then(setPush);
        void permissionState("camera").then(setCamera);
    }, []);
    return (
        <div className="bg-white rounded-2xl px-4 py-1">
            {hasChat && (
                <SettingsRow
                    icon={<Bell {...rowIcon} />}
                    label={t("account.chatNotifications")}
                    sublabel={push ? t(SUBLABEL[push]) : undefined}
                    onClick={
                        push === "blocked"
                            ? () => showPermissionHelp("notifications", "blocked")
                            : undefined
                    }
                    right={
                        push === "on" || push === "off" ? (
                            <Switch
                                on={push === "on"}
                                label={t("account.chatNotifications")}
                                onChange={(want) => {
                                    if (want) return void on.turnOn();
                                    if (busy) return;
                                    setBusy(true);
                                    void turnPushOff()
                                        .catch(() => {})
                                        .then(pushState)
                                        .then(setPush)
                                        .finally(() => setBusy(false));
                                }}
                            />
                        ) : undefined
                    }
                />
            )}
            <SettingsRow
                icon={<Camera {...rowIcon} />}
                label={t("account.camera")}
                sublabel={camera ? t(`account.cameraState.${camera}`) : undefined}
                onClick={
                    camera === "denied"
                        ? () => showPermissionHelp("camera", "blocked")
                        : camera === "prompt"
                          ? () =>
                                void askCamera().then(async (yes) => {
                                    if (!yes) showPermissionHelp("camera", "notAsked");
                                    setCamera(await permissionState("camera"));
                                })
                          : undefined
                }
                right={camera === "granted" || camera === "unsupported" ? <span /> : undefined}
            />
        </div>
    );
}
