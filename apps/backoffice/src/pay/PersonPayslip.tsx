import { ShareAction } from "@tea-pos/chat/ShareAction";
import { useT } from "@tea-pos/i18n/react";

import { PayConfirm } from "./PayConfirm";
import { Payslip } from "./Payslip";
import { usePayPeriodAt } from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { EmptyState } from "@tea-pos/ui/EmptyState";

/**
 * A payslip found by its period and person, so its address reads as what it is. The period's
 * own query (usually in the cache from the Pay home) names the payout.
 */
export function PersonPayslip({
    start,
    userId,
    settle,
}: {
    start: string;
    userId: string;
    settle?: boolean;
}) {
    const t = useT();
    const { data } = usePayPeriodAt(start);
    if (!data) return <Skeleton className="h-40 rounded-2xl" />;
    const payout = data.people.find((p) => p.userId === userId);
    if (!payout) return <EmptyState title={t("pay.noPayslip")} />;
    if (settle) return <PayConfirm id={payout.id} />;
    return (
        <>
            <ShareAction link={{ kind: "payout", id: payout.id }} />
            <Payslip id={payout.id} />
        </>
    );
}
