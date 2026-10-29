import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { DetailList } from "@tea-pos/ui/DetailList";

const TOPICS = ["OneAccount", "Seller", "Office", "Owner", "Stores", "Inactive", "Requests"];

/** How access works: apps, levels, the owner, stores, inactive and requests, in plain words. */
export function AccessHelp() {
    const t = useT();
    return (
        <DetailList>
            {TOPICS.map((topic) => (
                <div
                    key={topic}
                    className="py-4 border-b border-gray-100 last:border-none space-y-1"
                >
                    <p className="text-base font-semibold text-gray-900">
                        {t(`uac.help${topic}` as MessageKey)}
                    </p>
                    <p className="text-sm text-gray-700">
                        {t(`uac.help${topic}Body` as MessageKey)}
                    </p>
                </div>
            ))}
        </DetailList>
    );
}
