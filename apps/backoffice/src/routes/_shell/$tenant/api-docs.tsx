import { loadArea } from "@tea-pos/i18n";
import { useAccess } from "@tea-pos/shell/tenant";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/$tenant/api-docs")({
    loader: () => loadArea("more"),
    staticData: { shell: { titleKey: "moreRows.apiDocs", parent: "lastRootTab" } },
    component: function ApiDocs() {
        // Go answers the reference only to the owner; the screen just does not offer it to others.
        if (!useAccess().owner) return null;
        return (
            <iframe
                src="/api/docs"
                title="API docs"
                className="absolute inset-0 size-full border-0 bg-white"
            />
        );
    },
});
