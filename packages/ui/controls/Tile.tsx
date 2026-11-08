import { Skeleton } from "../feedback/Skeleton";

/** A small coloured figure: its label over its value, cut short rather than wrapped; undefined while loading. */
export function Tile({
    label,
    value,
    className,
    color = "text-gray-900",
}: {
    label: string;
    value: string | undefined;
    /** Its colour: `bg-teal-100`. */
    className: string;
    /** The value's colour, a shade of the tile's own: `text-teal-900`, as a day's cash summary. */
    color?: string;
}) {
    return (
        <div className={`min-w-0 rounded-lg p-2 ${className}`}>
            <p className="text-xs font-semibold text-gray-900 truncate">{label}</p>
            {value === undefined ? (
                <Skeleton className="mt-1 h-5 w-10 rounded bg-black/10" />
            ) : (
                <p className={`text-base font-bold truncate ${color}`}>{value}</p>
            )}
        </div>
    );
}
