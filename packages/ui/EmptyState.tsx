import { DOT_GRID } from "./styles/dot-grid";
import { Emoji, type EmojiName } from "./Emoji";

// One picture for every empty screen, so an empty state costs one small file at most.
const EMPTY: EmojiName = "emptyNest";

/** Nothing to show: a white card, the dot grid and one emoji, a bold title and a line under it. */
export function EmptyState({ title, body }: { title: string; body?: string }) {
    return (
        <div className="rounded-2xl bg-white p-5 text-center space-y-2">
            <div className="relative -mx-5 flex justify-center py-2">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={DOT_GRID}
                />
                <Emoji name={EMPTY} size={72} className="relative" />
            </div>
            <p className="text-lg font-bold text-gray-900">{title}</p>
            {body && <p className="text-sm text-gray-900">{body}</p>}
        </div>
    );
}
