import { $api } from "@tea-pos/api-client";
import { useT } from "@tea-pos/i18n/react";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { useRouter } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { currentVersion, useAppUpdate, useUpdateState } from "../frame/AppUpdate";
import { UpdateNow } from "../frame/UpdateNow";
import { useUpdateText } from "../frame/useUpdateText";

/** Is the API reachable, which build is running, and is it the latest: More's App info page. */
export function StatusScreen() {
    const t = useT();
    const router = useRouter();
    const health = $api.useQuery("get", "/health");
    const { peek } = useAppUpdate();
    const state = useUpdateState();
    const stateText = useUpdateText(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => peek(), []);
    const loading = <Skeleton className="h-4 w-16 rounded" />;
    const rows: [string, ReactNode][] = [
        [
            t("status.api"),
            health.isSuccess ? t("status.ok") : health.isError ? t("status.down") : loading,
        ],
        [t("status.version"), health.data?.version ?? loading],
        [t("status.commit"), health.data?.commit.slice(0, 7) ?? loading],
        [t("status.app"), currentVersion()],
        // Behind: no words, the button below says it.
        ...(state === "available"
            ? []
            : [[t("status.update"), stateText || loading] as [string, ReactNode]]),
    ];

    return (
        <div className="rounded-2xl bg-white px-4 py-1 divide-y divide-gray-100">
            {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-3 text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-mono text-gray-900 text-right">{value}</span>
                </div>
            ))}
            {state === "available" && (
                // The download shows in a tab's header: back to More, where it runs.
                <div className="py-3">
                    <UpdateNow onStarted={() => router.history.back()} />
                </div>
            )}
        </div>
    );
}
