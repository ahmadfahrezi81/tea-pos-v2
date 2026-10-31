/** Pick one of a few short words, side by side; the compact ChoiceList. */
export function Segmented<T extends string>({
    choices,
    value,
    onChange,
    disabled = false,
}: {
    choices: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {choices.map((c) => (
                <button
                    key={c.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(c.value)}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold text-gray-900 disabled:opacity-40 ${c.value === value ? "bg-white shadow-sm" : ""}`}
                >
                    {c.label}
                </button>
            ))}
        </div>
    );
}
