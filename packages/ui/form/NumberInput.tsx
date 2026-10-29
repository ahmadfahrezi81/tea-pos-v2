import { Pencil } from "lucide-react";
import { useState } from "react";
import { ICON } from "../icon";

const show = (v: number | null, raw: boolean) =>
    v === null ? "" : raw ? String(v) : v.toLocaleString("id-ID");

/**
 * The old apps' number field: digits only, grouped as rupiah (`15.000`), with a prefix (`Rp`) or a
 * unit after the value. `null` is empty; 0 is a real value.
 */
export function NumberInput({
    value,
    onChange,
    placeholder = "0",
    currency = false,
    unit,
    prefix,
    raw = false,
}: {
    value: number | null;
    onChange: (value: number | null) => void;
    placeholder?: string;
    currency?: boolean;
    unit?: string;
    prefix?: string;
    /** No grouping: for counts that are not amounts. */
    raw?: boolean;
}) {
    const [text, setText] = useState(show(value, raw));
    const [last, setLast] = useState(value);
    // A new value from outside (the form reset, data arriving) replaces what is shown.
    if (value !== last) {
        setLast(value);
        if (value !== (text === "" ? null : Number(text.replace(/\D/g, ""))))
            setText(show(value, raw));
    }
    const change = (input: string) => {
        const digits = input.replace(/\D/g, "");
        const num = digits === "" ? null : parseInt(digits, 10);
        setText(num === null ? "" : raw ? digits : num.toLocaleString("id-ID"));
        setLast(num);
        onChange(num);
    };
    return (
        <label className="group flex items-center gap-2 p-4 px-3 border-2 border-gray-100 rounded-2xl bg-gray-50 transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            <div className="flex items-center gap-2 min-w-0 flex-1">
                {(currency || prefix) && (
                    <span className="text-2xl font-bold text-gray-400 shrink-0">
                        {prefix ?? "Rp"}
                    </span>
                )}
                {/* Sized to its value, so a unit follows the digits instead of the field's far edge. */}
                <input
                    type="text"
                    inputMode="numeric"
                    value={text}
                    onChange={(e) => change(e.target.value)}
                    placeholder={placeholder}
                    size={Math.max((text || placeholder).length, 1)}
                    className="text-2xl font-bold text-gray-900 border-none outline-none bg-transparent max-w-full min-w-0 field-sizing-content"
                />
                {unit && <span className="text-2xl font-bold text-gray-400 shrink-0">{unit}</span>}
            </div>
            {text !== "" && (
                <Pencil
                    size={ICON}
                    strokeWidth={2.5}
                    className="text-gray-400 shrink-0 group-focus-within:hidden"
                />
            )}
        </label>
    );
}
