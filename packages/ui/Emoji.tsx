import alarmClock from "./emoji/alarm-clock.svg";
import refresh from "./emoji/counterclockwise-arrows-button.svg";
import floppyDisk from "./emoji/floppy-disk.svg";
import moneyWithWings from "./emoji/money-with-wings.svg";
import receipt from "./emoji/receipt.svg";
import sparkles from "./emoji/sparkles.svg";

// Fluent emoji as files: cached by the service worker, never in the JavaScript.
const sources = {
    sparkles,
    refresh,
    floppyDisk,
    moneyWithWings,
    receipt,
    alarmClock,
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
