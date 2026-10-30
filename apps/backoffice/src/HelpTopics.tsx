import type { MessageKey } from "@tea-pos/i18n";
import { useT } from "@tea-pos/i18n/react";
import { DetailList } from "@tea-pos/ui/DetailList";

/** A core's How it works: topics, each a heading (`<area>.help<Topic>`) and points (`…Body`, one a line). */
export function HelpTopics({ area, topics }: { area: string; topics: string[] }) {
    const t = useT();
    return (
        <DetailList>
            {topics.map((topic) => (
                <div
                    key={topic}
                    className="py-4 border-b border-gray-100 last:border-none space-y-2"
                >
                    <p className="text-base font-semibold text-gray-900">
                        {t(`${area}.help${topic}` as MessageKey)}
                    </p>
                    <ul className="space-y-1">
                        {t(`${area}.help${topic}Body` as MessageKey)
                            .split("\n")
                            .map((line) => (
                                <Line key={line} text={line} />
                            ))}
                    </ul>
                </div>
            ))}
        </DetailList>
    );
}

/** One point; a `Label: text` line shows its label in bold. */
function Line({ text }: { text: string }) {
    const at = text.indexOf(": ");
    return (
        <li className="flex gap-2 text-sm text-gray-900">
            <span className="text-gray-900">•</span>
            <span>
                {at > 0 && at < 20 ? (
                    <>
                        <span className="font-semibold">{text.slice(0, at)}:</span>
                        {text.slice(at + 1)}
                    </>
                ) : (
                    text
                )}
            </span>
        </li>
    );
}
