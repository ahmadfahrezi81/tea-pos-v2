import { useT } from "@tea-pos/i18n/react";
import { BotMessageSquare } from "lucide-react";

/** System's photo (task 078): a robot as a chat bubble, where a person's photo would be. */
export function SystemFace({ size = 32 }: { size?: number }) {
    return (
        <span
            className="flex shrink-0 items-center justify-center rounded-[28.6%] bg-brand text-white"
            style={{ width: size, height: size }}
        >
            <BotMessageSquare size={Math.round(size * 0.6)} />
        </span>
    );
}

/** BOT beside a name that is not a person's (System now; an assistant later), as Slack's APP. */
export function BotBadge() {
    const t = useT();
    return (
        <span className="rounded-sm bg-slate-200 px-1 text-[10px] font-bold leading-4 tracking-wide text-gray-700">
            {t("chat.bot")}
        </span>
    );
}
