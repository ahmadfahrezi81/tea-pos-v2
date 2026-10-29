import { formatRelative } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { Avatar } from "@tea-pos/ui/Avatar";
import { ConfirmSheet, FormFooter } from "@tea-pos/shell/FormFooter";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { useAccess } from "@tea-pos/shell/tenant";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

import { AccessFields } from "./PersonPage";
import { useApprove, useReject, useUacRequest, type Change } from "./uac";
import { Skeleton } from "@tea-pos/ui/Skeleton";

/**
 * Someone asking to join: pick their levels and stores and let them in, or turn them down.
 * Block also drops their later asks, without telling them.
 */
export function RequestPage({ id }: { id: string }) {
    const t = useT();
    const locale = useLocale();
    const router = useRouter();
    const { canWrite } = useAccess();
    const { data, isError } = useUacRequest(id);
    const approve = useApprove(id);
    const reject = useReject(id);
    const [change, setChange] = useState<Change>({
        access: { seller: "member", backoffice: "" },
        storeIds: [],
        active: true,
    });
    const set = (next: Partial<Change>) => setChange((c) => ({ ...c, ...next }));
    // Reject (false) or block (true), waiting for the sheet's yes.
    const [declining, setDeclining] = useState<boolean | null>(null);

    if (isError)
        return (
            <p className="rounded-2xl bg-white p-4 text-sm text-gray-700">{t("uac.requestGone")}</p>
        );
    if (!data) return <Skeleton className="h-60 rounded-2xl" />;

    const decline = async (block: boolean) => {
        await reject.mutateAsync({ block });
        router.history.back();
    };
    const asked = declining !== null;

    return (
        <div className="space-y-4">
            <HeaderTitle>{data.name}</HeaderTitle>

            <div className="flex items-center gap-3 rounded-2xl bg-white p-4">
                <Avatar url={data.avatarUrl} size={44} />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-600">{data.email}</p>
                    <p className="text-sm text-gray-500">
                        {t("uac.askedAt").replace("{when}", formatRelative(data.at, locale))}
                    </p>
                </div>
            </div>

            <AccessFields change={change} set={set} disabled={!canWrite} />

            {canWrite && (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        disabled={reject.isPending}
                        onClick={() => setDeclining(false)}
                        className="rounded-xl bg-gray-100 py-3 font-semibold text-gray-700 disabled:opacity-60"
                    >
                        {t("uac.reject")}
                    </button>
                    <button
                        disabled={reject.isPending}
                        onClick={() => setDeclining(true)}
                        className="rounded-xl bg-red-50 py-3 font-semibold text-red-600 disabled:opacity-60"
                    >
                        {t("uac.block")}
                    </button>
                </div>
            )}
            {canWrite && <p className="px-1 text-xs text-gray-500">{t("uac.blockNote")}</p>}

            <ConfirmSheet
                open={asked}
                title={t(declining ? "uac.blockTitle" : "uac.rejectTitle").replace(
                    "{name}",
                    data.name,
                )}
                message={t(declining ? "uac.blockBody" : "uac.rejectBody")}
                label={t(declining ? "uac.block" : "uac.reject")}
                busyLabel={t("uac.saving")}
                tone={declining ? "orange" : "gray"}
                onConfirm={() => decline(!!declining)}
                onError={() => setDeclining(null)}
                onCancel={() => setDeclining(null)}
            />

            {canWrite && (
                <FormFooter
                    label={t("uac.approve")}
                    busyLabel={t("uac.saving")}
                    confirmTitle={t("uac.approveTitle").replace("{name}", data.name)}
                    note={{ title: t("uac.noteTitle"), body: t("uac.confirmBody") }}
                    onSubmit={async () => {
                        await approve.mutateAsync(change);
                        router.history.back();
                    }}
                />
            )}
        </div>
    );
}
