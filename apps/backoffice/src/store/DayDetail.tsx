import { useT } from "@tea-pos/i18n/react";
import { DayView } from "@tea-pos/shell/DayView";

import { useDay } from "./sales";

/** A day in the Store tab: the shared day screen, fetched for the backoffice. */
export function DayDetail({ id }: { id: string }) {
    const t = useT();
    const { data: day, error } = useDay(id);
    if (error)
        return (
            <p className="bg-white rounded-2xl p-4 text-sm text-gray-600">
                {t("errors.day_not_found")}
            </p>
        );
    if (!day)
        return (
            <div className="space-y-4">
                {[160, 320, 120].map((h) => (
                    <div key={h} className="bg-white rounded-2xl" style={{ height: h }} />
                ))}
            </div>
        );
    return <DayView day={day} />;
}
