import { $api } from "@tea-pos/api-client";
import { useT } from "@tea-pos/i18n/react";

import { APP_COMMIT } from "./version";

/** Is the API reachable, and which build is running; shown under home for now. */
export function StatusScreen() {
    const t = useT();
    const health = $api.useQuery("get", "/health");
    const rows: [string, string][] = [
        [
            t("status.api"),
            health.isSuccess ? t("status.ok") : health.isError ? t("status.down") : "…",
        ],
        [t("status.version"), health.data?.version ?? "…"],
        [t("status.commit"), health.data?.commit.slice(0, 7) ?? "…"],
        [t("status.app"), APP_COMMIT],
    ];

    return (
        <div className="rounded-2xl bg-white p-4 divide-y divide-gray-100">
            {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between py-3 text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-mono text-gray-900">{value}</span>
                </div>
            ))}
        </div>
    );
}
