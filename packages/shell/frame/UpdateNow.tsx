import { useT } from "@tea-pos/i18n/react";
import { Download } from "lucide-react";

import { useAppUpdate } from "./AppUpdate";

/** A newer build is out and not coming in on its own: the small red way to fetch it now. */
export function UpdateNow({ onStarted }: { onStarted?: () => void }) {
    const t = useT();
    const update = useAppUpdate();
    return (
        <button
            onClick={() => void update.checkNow().then((r) => r === "started" && onStarted?.())}
            className="flex items-center gap-1.5 text-sm font-semibold text-red-600 active:opacity-60"
        >
            <Download size={16} strokeWidth={2.5} />
            {t("more.updateNow")}
        </button>
    );
}
