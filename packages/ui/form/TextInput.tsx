import { Pencil } from "lucide-react";

/** The old apps' text field: a soft grey tile, a pencil once it holds a value (gone while typing). */
export function TextInput({
    value,
    onChange,
    placeholder,
    type = "text",
    className = "text-xl font-bold",
    inputMode,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
    className?: string;
    /** "numeric" for digit strings that are not amounts (account numbers keep their zeros). */
    inputMode?: "text" | "numeric" | "tel" | "decimal" | "email" | "search" | "url";
}) {
    return (
        <label className="group flex items-center gap-2 p-4 px-3 border-2 border-gray-100 rounded-2xl bg-gray-50 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <input
                type={type}
                inputMode={inputMode}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`${className} text-gray-900 border-none outline-none bg-transparent w-full min-w-0 placeholder:text-gray-300`}
            />
            {value !== "" && (
                <Pencil
                    size={20}
                    strokeWidth={2.5}
                    className="text-gray-400 shrink-0 group-focus-within:hidden"
                />
            )}
        </label>
    );
}
