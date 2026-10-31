/** A small coloured figure: its label over its value, cut short rather than wrapped. */
export function Tile({
    label,
    value,
    className,
}: {
    label: string;
    value: string;
    /** Its colour: `bg-teal-100`. */
    className: string;
}) {
    return (
        <div className={`min-w-0 rounded-lg p-2 ${className}`}>
            <p className="text-xs font-semibold text-gray-900 truncate">{label}</p>
            <p className="text-base font-bold text-gray-900 truncate">{value}</p>
        </div>
    );
}
