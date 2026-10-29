/** The old apps' select; picking `otherTriggerValue` opens a text field beside it. */
export function SelectInput({
    options,
    value,
    onChange,
    placeholder,
    otherTriggerValue,
    otherValue,
    onOtherChange,
    otherPlaceholder,
}: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    otherTriggerValue?: string;
    otherValue?: string;
    onOtherChange?: (value: string) => void;
    otherPlaceholder?: string;
}) {
    const showOther = !!otherTriggerValue && value === otherTriggerValue;
    const box =
        "w-full p-3 border border-gray-200 rounded-xl text-base focus:ring-2 focus:ring-brand/90 focus:outline-none bg-white";
    return (
        <div className="flex flex-col gap-2">
            <select value={value} onChange={(e) => onChange(e.target.value)} className={box}>
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            {showOther && (
                <input
                    type="text"
                    value={otherValue ?? ""}
                    onChange={(e) => onOtherChange?.(e.target.value)}
                    placeholder={otherPlaceholder}
                    className={box}
                />
            )}
        </div>
    );
}
