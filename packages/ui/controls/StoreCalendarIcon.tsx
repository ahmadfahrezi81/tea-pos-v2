import { useId } from "react";

const S = 0.68;
const AT = 24 - 24 * S;
// About Lucide's own weight at the size the picker draws it (2.5 px at 40 px).
const STROKE = 2.1;
// Around the calendar, the store is cut away (a mask, so nothing paints over the box's colour).
const GAP = 3.6;

/**
 * Lucide's Store and CalendarDays at the same size, overlapping corner to corner, the calendar in
 * front cutting into the store: a picker of the store and the date at once. Drawn in currentColor.
 */
export function StoreCalendarIcon({ size = 24, className }: { size?: number; className?: string }) {
    // Plain characters only: some browsers miss a url(#…) with React's id punctuation in it.
    const cut = `cut${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
    return (
        <svg
            width={size}
            height={size}
            // Cropped to the drawing itself (Lucide leaves a margin): as large as the box allows.
            viewBox="0 0.2 23 23"
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden
        >
            <mask id={cut} maskUnits="userSpaceOnUse" x="-1" y="-1" width="26" height="26">
                <rect x="-1" y="-1" width="26" height="26" fill="#fff" stroke="none" />
                <rect
                    x={AT + (3 - GAP) * S}
                    y={AT + (2 - GAP) * S}
                    width={(18 + 2 * GAP) * S}
                    height={(19 + 2 * GAP) * S}
                    rx={(2 + GAP) * S}
                    fill="#000"
                    stroke="none"
                />
            </mask>
            {/* The mask on an outer group: on the scaled one its rectangle would be scaled again. */}
            <g mask={`url(#${cut})`}>
                <g transform={`scale(${S})`}>
                    <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />
                    <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" />
                    <path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05" />
                </g>
            </g>
            <g transform={`translate(${AT} ${AT}) scale(${S})`}>
                <path d="M8 2v3" />
                <path d="M16 2v3" />
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M8 13h.01" />
                <path d="M12 13h.01" />
                <path d="M16 13h.01" />
                <path d="M8 17h.01" />
                <path d="M12 17h.01" />
                <path d="M16 17h.01" />
            </g>
        </svg>
    );
}
