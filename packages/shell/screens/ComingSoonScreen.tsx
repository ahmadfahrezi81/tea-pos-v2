import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { ComingSoon } from "@tea-pos/ui/ComingSoon";

/** A tab whose screens come in a later step: the old app's placeholder card. */
export function comingSoon(nameKey: MessageKey) {
    return function ComingSoonScreen() {
        const t = useT();
        return (
            <ComingSoon
                title={t("shell.comingSoon").replace("{name}", t(nameKey))}
                subtitle={t("shell.inDevelopment")}
            />
        );
    };
}
