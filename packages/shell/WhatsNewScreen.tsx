import { useLocale, useT } from "@tea-pos/i18n/react";
import { useEffect, useState } from "react";

import { useApp } from "./AppContext";
import { loadWhatsNew, markSeen, type WhatsNewEntry } from "./whatsNew";

/** Each release's changes a user can notice, in their language, newest first. */
export function WhatsNewScreen() {
    const t = useT();
    const locale = useLocale();
    const { id } = useApp();
    const [entries, setEntries] = useState<WhatsNewEntry[] | null>(null);

    useEffect(() => {
        markSeen();
        void loadWhatsNew(id).then(setEntries);
    }, [id]);

    if (!entries) return null;
    if (!entries.length)
        return (
            <p className="rounded-2xl bg-white p-4 text-sm text-gray-500">{t("whatsNew.empty")}</p>
        );
    return (
        <div className="flex flex-col gap-3">
            {entries.map((e) => (
                <div key={e.version} className="rounded-2xl bg-white p-4">
                    <p className="font-bold text-gray-900">{e.version}</p>
                    <p className="text-xs text-gray-400 mb-2">{e.date}</p>
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
