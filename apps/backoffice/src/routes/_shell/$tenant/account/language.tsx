import { createFileRoute } from "@tanstack/react-router";
import { LanguageScreen } from "@tea-pos/shell/LanguageScreen";

export const Route = createFileRoute("/_shell/$tenant/account/language")({
    staticData: { shell: { titleKey: "language.title", parent: ".." } },
    component: LanguageScreen,
});
