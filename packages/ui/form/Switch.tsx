/** The old apps' on/off switch. */
export function Switch({
    on,
    onChange,
    label,
}: {
    on: boolean;
    onChange: (on: boolean) => void;
    label: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            onClick={() => onChange(!on)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-brand" : "bg-gray-200"}`}
        >
            <span
                className={`absolute top-0.5 left-0.5 size-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`}
            />
        </button>
    );
}
