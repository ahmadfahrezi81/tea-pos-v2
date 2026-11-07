import { useConnection, type Level } from "@tea-pos/api-client/connection";
import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { Check, WifiLow, WifiOff, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const BACK_ONLINE_MS = 2000;

const LOOK: Partial<Record<Level, [LucideIcon, MessageKey, string]>> = {
    offline: [WifiOff, "connection.offline", "bg-gray-900"],
    failing: [WifiOff, "connection.failing", "bg-gray-900"],
    slow: [WifiLow, "connection.slow", "bg-amber-600"],
};

/** Under the tabs, only when the connection is in trouble, as Spotify and YouTube do; then "Back online" briefly. */
export function OfflineBanner() {
    const t = useT();
    const { level } = useConnection();
    const [back, setBack] = useState(false);
    const was = useRef(level);

    useEffect(() => {
        const cut = was.current === "offline" || was.current === "failing";
        was.current = level;
        if (!cut || level === "offline" || level === "failing") return;
        setBack(true);
        const timer = setTimeout(() => setBack(false), BACK_ONLINE_MS);
        return () => clearTimeout(timer);
    }, [level]);

    const look: [LucideIcon, MessageKey, string] | undefined =
        LOOK[level] ?? (back ? [Check, "connection.backOnline", "bg-green-600"] : undefined);
    if (!look) return null;
    const [Icon, key, color] = look;
    return (
        <div
            role="status"
            className={`flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-semibold text-white ${color}`}
        >
            <Icon size={16} strokeWidth={2.75} />
            {t(key)}
        </div>
    );
}
