import { useLocale, useT } from "@tea-pos/i18n/react";
import { useEffect, useState } from "react";

import { useApp } from "../session/AppContext";
import { useSearchParam } from "../session/searchParam";
import { loadWhatsNew, markSeen, type WhatsNewEntry } from "../lib/whatsNew";
import { EmptyState } from "@tea-pos/ui/EmptyState";

/** Each release's changes a user can notice, in their language, newest first. */
export function WhatsNewScreen() {
    const t = useT();
    const locale = useLocale();
    const { id } = useApp();
    const [entries, setEntries] = useState<WhatsNewEntry[] | null>(null);
    // A release's link in chat opens at its version.
    const [version] = useSearchParam("v");

    useEffect(() => {
        markSeen();
        void loadWhatsNew(id).then(setEntries);
    }, [id]);

    useEffect(() => {
        if (entries && version)
            document.getElementById(`v-${version}`)?.scrollIntoView({ block: "start" });
    }, [entries, version]);

    if (!entries) return null;
    if (!entries.length) return <EmptyState title={t("whatsNew.empty")} />;
    return (
        <div className="flex flex-col gap-3">
            {entries.map((e) => (
                <div
                    key={e.version}
                    id={`v-${e.version}`}
                    className={`scroll-mt-4 rounded-2xl bg-white p-4 ${e.version === version ? "ring-2 ring-brand" : ""}`}
                >
                    <p className="font-bold text-gray-900">{e.version}</p>
                    <p className="text-xs text-gray-600 mb-2">{e.date}</p>
                    <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                        {(e.lines[locale] ?? e.lines.en).map((line) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}
