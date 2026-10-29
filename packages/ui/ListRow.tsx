import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "./Skeleton";
import { ICON } from "./icon";

/**
 * A record in a list (a staff member, a claim type, a payout), as the old apps: the same
 * height, divider and card as SettingsRow. A button only with `onClick`: a row whose trailing
 * slot holds its own button stays a div.
 */
export function ListRow({
    leading,
    title,
    subtitle,
    trailing,
    onClick,
}: {
    leading?: ReactNode;
    title: ReactNode;
    subtitle?: ReactNode;
    /** Replaces the chevron: a status, a value, its own button. */
    trailing?: ReactNode;
    onClick?: () => void;
}) {
    const body = (
        <>
            {leading && <span className="shrink-0 flex items-center py-4">{leading}</span>}
            <div className="flex-1 min-w-0 flex items-center gap-3 py-4 -mr-4 pr-4 border-b-2 border-slate-100 group-last:border-b-0">
                <div className="flex-1 min-w-0">
                    <div className="text-[17px] font-medium text-gray-900 truncate">{title}</div>
                    {subtitle && <div className="text-sm text-gray-400 truncate">{subtitle}</div>}
                </div>
                {trailing ??
                    (onClick && (
                        <ChevronRight
                            size={ICON}
                            strokeWidth={2.5}
                            className="text-brand/90 shrink-0"
                        />
                    ))}
            </div>
        </>
    );
    const className = `group w-full flex items-stretch gap-3 text-left ${onClick ? "active:bg-gray-50" : ""}`;
    return onClick ? (
        <button onClick={onClick} className={className}>
            {body}
        </button>
    ) : (
        <div className={className}>{body}</div>
    );
}

/** The card ListRows sit in. */
export function ListCard({ children }: { children: ReactNode }) {
    return <div className="bg-white rounded-2xl px-4 py-1">{children}</div>;
}

/** A row's placeholder at the same height, so the list does not jump on load. */
export function ListRowSkeleton({ withLeading = false }: { withLeading?: boolean }) {
    return (
        <div className="group w-full flex items-stretch gap-3">
            {withLeading && (
                <span className="shrink-0 flex items-center py-4">
                    <Skeleton className="size-9 rounded-xl" />
                </span>
            )}
            <div className="flex-1 py-4 -mr-4 pr-4 border-b-2 border-slate-100 group-last:border-b-0 space-y-1.5">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3.5 w-20 rounded" />
            </div>
        </div>
    );
}
