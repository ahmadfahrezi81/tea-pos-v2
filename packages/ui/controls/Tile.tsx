import { Skeleton } from "../feedback/Skeleton";

/** A small coloured figure: its label over its value, cut short rather than wrapped; undefined while loading. */
export function Tile({
    label,
    value,
    className,
}: {
    label: string;
    value: string | undefined;
    /** Its colour: `bg-teal-100`. */
    className: string;
}) {
    return (
        <div className={`min-w-0 rounded-lg p-2 ${className}`}>
            <p className="text-xs font-semibold text-gray-900 truncate">{label}</p>
            {value === undefined ? (
                <Skeleton className="mt-1 h-5 w-10 rounded bg-black/10" />
            ) : (
                <p className="text-base font-bold text-gray-900 truncate">{value}</p>
            )}
        </div>
    );
}
