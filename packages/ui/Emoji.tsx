import refresh from "./emoji/counterclockwise-arrows-button.svg";
import sparkles from "./emoji/sparkles.svg";

// Fluent emoji as files: cached by the service worker, never in the JavaScript.
const sources = {
    sparkles,
    refresh,
} as const;

export type EmojiName = keyof typeof sources;

export function Emoji({
    name,
    size,
    className,
}: {
    name: EmojiName;
    size: number;
    className?: string;
}) {
    return (
        <img
            src={sources[name]}
            width={size}
            height={size}
            alt=""
            draggable={false}
            className={className}
        />
    );
}
