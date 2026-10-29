/** The old apps' text area. */
export function Textarea({
    value,
    onChange,
    placeholder,
    rows = 4,
    maxLength,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    maxLength?: number;
}) {
    return (
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLength}
            className="w-full p-3 border border-gray-200 rounded-xl text-base resize-none focus:ring-2 focus:ring-brand/90 focus:outline-none"
        />
    );
}
