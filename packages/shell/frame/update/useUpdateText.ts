import { useT } from "@tea-pos/i18n/react";

import type { useUpdateState } from "./AppUpdate";

/** The update's state in words: Latest. Behind says nothing (Update now shows instead); offline neither, the banner says it. */
export function useUpdateText(state: ReturnType<typeof useUpdateState>): string {
    const t = useT();
    if (state === "latest") return t("more.updateIsLatest");
    return "";
}
