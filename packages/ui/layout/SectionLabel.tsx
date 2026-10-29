import type { ReactNode } from "react";

/** The small bold uppercase heading over a card or a field; `inset` lines it up with a card's text. */
export function SectionLabel({ children, inset = true }: { children: ReactNode; inset?: boolean }) {
    return (
        <p
            className={`text-xs font-bold uppercase tracking-widest text-gray-900 ${inset ? "pl-3 in-[.sheet]:pl-0" : ""}`}
        >
            {children}
        </p>
    );
}
