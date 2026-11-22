import { Bot } from "lucide-react";

/** System's photo (task 077): the app's own messages, in the same place as a person's. */
export function SystemFace({ size = 32 }: { size?: number }) {
    return (
        <span
            className="flex shrink-0 items-center justify-center rounded-[28.6%] bg-brand text-white"
            style={{ width: size, height: size }}
        >
            <Bot size={Math.round(size * 0.6)} />
        </span>
    );
}
