import { useT } from "@tea-pos/i18n/react";

/**
 * Covers the shell when it cannot draw: maintenance, or a profile that failed to
 * load. Loading itself is index.html's splash; this has the same look.
 */
export function BootScreen({
    state,
    onRetry,
}: {
    state: "maintenance" | "authError";
    onRetry?: () => void;
}) {
    const t = useT();
    return (
        <div className="boot" role="status" aria-live="polite">
            <img
                className="boot-logo"
                src="/icons/icon-192x192.png"
                alt=""
                width={70}
                height={70}
            />
            {state === "maintenance" ? (
                <>
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">
                        {t("shell.maintenance")}
                    </h2>
                    <p className="text-gray-500 text-sm max-w-xs">{t("shell.maintenanceSub")}</p>
                </>
            ) : (
                <>
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">
                        {t("common.authRequired")}
                    </h2>
                    <p className="text-gray-600 mb-6 text-sm">{t("common.authRequiredSub")}</p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium"
                        >
                            {t("common.refresh")}
                        </button>
                        <button
                            onClick={onRetry}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                        >
                            {t("common.retry")}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
