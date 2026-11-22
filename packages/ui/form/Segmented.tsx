/** Pick one of a few short words, side by side; the compact ChoiceList. `lg`: seller's POS / Manage look. */
export function Segmented<T extends string>({
    choices,
    value,
    onChange,
    disabled = false,
    size = "md",
}: {
    choices: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
    size?: "md" | "lg";
}) {
    const lg = size === "lg";
    return (
        <div className={`flex gap-1 rounded-xl p-1 ${lg ? "bg-slate-200" : "bg-slate-100"}`}>
            {choices.map((c) => {
                const on = c.value === value;
                return (
                    <button
                        key={c.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(c.value)}
                        className={
                            lg
                                ? `flex-1 rounded-lg px-3.5 py-1 text-lg font-semibold transition-all duration-200 disabled:opacity-40 ${on ? "bg-white text-slate-950" : "text-slate-600"}`
                                : `flex-1 rounded-lg py-2 text-sm font-semibold text-gray-900 disabled:opacity-40 ${on ? "bg-white shadow-sm" : ""}`
                        }
                    >
                        {c.label}
                    </button>
                );
            })}
        </div>
    );
}
