import { useT } from "@tea-pos/i18n/react";

import { buildLabel, type useUpdateState } from "./AppUpdate";

/** The update's state in words: Latest, `2026.11.9 available`, Offline; nothing while unknown. */
export function useUpdateText(
    state: ReturnType<typeof useUpdateState>,
    served: string | null | undefined,
): string {
    const t = useT();
    if (state === "latest") return t("more.updateIsLatest");
    if (state === "offline") return t("more.updateIsOffline");
    if (state === "available" && served)
        return t("more.updateAvailable").replace("{version}", buildLabel(served));
    return "";
}
