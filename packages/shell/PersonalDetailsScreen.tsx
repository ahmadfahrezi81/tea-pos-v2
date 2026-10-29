import { useMe } from "@tea-pos/api-client/me";
import { formatLongDate } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { CopyButton } from "@tea-pos/ui/CopyButton";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import type { ReactNode } from "react";

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="py-4 border-b border-gray-100 last:border-none">
            <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
            <div className="text-base text-gray-900 font-medium">{children}</div>
        </div>
    );
}

/** The old seller app's Personal Details, read only for now: who the account is. */
export function PersonalDetailsScreen() {
    const t = useT();
    const locale = useLocale();
    const user = useMe().data?.user;
    if (!user)
        return (
            <div className="bg-white rounded-xl px-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="py-4 space-y-2">
                        <Skeleton delay={i * 80} className="h-3 w-20 rounded" />
                        <Skeleton delay={i * 80} className="h-5 w-40 rounded" />
                    </div>
                ))}
            </div>
        );
    const [first = "—", ...rest] = user.fullName.trim().split(" ");
    const shortId = user.id.slice(0, 13).toUpperCase();
    return (
        <div className="bg-white rounded-xl px-4">
            <Row label={t("account.email")}>{user.email}</Row>
            <Row label={t("account.userId")}>
                <CopyButton
                    value={shortId}
                    size={18}
                    className="w-full flex items-center justify-between gap-3 active:opacity-70"
                >
                    {shortId}
                </CopyButton>
            </Row>
            <Row label={t("account.firstName")}>{first}</Row>
            <Row label={t("account.lastName")}>{rest.join(" ") || "—"}</Row>
            <Row label={t("account.phoneNumber")}>{user.phone || "—"}</Row>
            <Row label={t("account.memberSince")}>
                {user.since ? formatLongDate(user.since, locale) : "—"}
            </Row>
        </div>
    );
}
