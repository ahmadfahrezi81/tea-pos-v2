import { $api } from "@tea-pos/api-client";
import { useT } from "@tea-pos/i18n/react";

import { APP_COMMIT, APP_VERSION } from "../lib/version";

/** Is the API reachable, and which build is running: Account's App info page. */
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
        [t("status.app"), `${APP_VERSION} (${APP_COMMIT})`],
    ];

    return (
        <div className="rounded-2xl bg-white px-4 py-1 divide-y divide-gray-100">
            {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between py-3 text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-mono text-gray-900">{value}</span>
                </div>
            ))}
        </div>
    );
}
