import { Inbox, type LucideIcon } from "lucide-react";

/** Nothing to show: a white card, an icon on a grey circle, the title and a line under it. */
export function EmptyState({
    title,
    body,
    icon: Icon = Inbox,
    className = "py-8",
}: {
    title: string;
    body?: string;
    icon?: LucideIcon;
    /** The card's height: compact by default, `min-h-full py-24` for a whole screen. */
    className?: string;
}) {
    return (
        <div
            className={`rounded-2xl bg-white flex flex-col items-center justify-center gap-4 px-5 ${className}`}
        >
            <div className="size-24 rounded-full bg-gray-100 flex items-center justify-center">
                <Icon className="size-12 text-gray-400" />
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-gray-500">{title}</p>
                {body && <p className="text-xs text-gray-400 mt-0.5">{body}</p>}
            </div>
        </div>
    );
}
