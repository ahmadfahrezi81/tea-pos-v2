import { useT } from "@tea-pos/i18n/react";

import { PayConfirm } from "./PayConfirm";
import { Payslip } from "./Payslip";
import { usePayPeriodAt } from "./pay";
import { Skeleton } from "@tea-pos/ui/Skeleton";

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
    if (!payout) return <p className="py-10 text-center text-gray-400">{t("pay.noPayslip")}</p>;
    return settle ? <PayConfirm id={payout.id} /> : <Payslip id={payout.id} />;
}
