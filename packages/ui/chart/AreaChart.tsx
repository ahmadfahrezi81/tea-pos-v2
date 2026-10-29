import { useEffect, useRef, useState } from "react";

export interface ChartPoint {
    /** Stable id (a date). */
    key: string;
    /** Under the point: `22 Oct`. */
    label: string;
    value: number;
}

interface Props {
    points: ChartPoint[];
    /** The value as written over its point and in the tooltip. */
    format?: (value: number) => string;
    /** What the tooltip names the value: `cups`. */
    unit?: string;
    /** `step` as the old mini charts; `line` straight between points. */
    shape?: "step" | "line";
    height?: number;
    /** Width per point; a month wider than the phone scrolls sideways. */
    slot?: number;
}

const PAD_TOP = 22;
const PAD_BOTTOM = 22;
// Room at each end, so the first and last labels are not cut.
const PAD_X = 16;

/**
 * Values over time, in plain SVG (no chart library): a line and a light fill in the brand
 * colour, each value over its point (the peak in bold), a tap shows that point's tooltip.
 * Opens scrolled to the peak, as the old app's mini chart did.
 */
export function AreaChart({
    points,
    format = String,
    unit,
    shape = "step",
    height = 150,
    slot = 56,
}: Props) {
    const scroll = useRef<HTMLDivElement>(null);
    const [picked, setPicked] = useState<number | null>(null);
    const width = Math.max(points.length * slot + 2 * PAD_X, 280);
    const max = Math.max(1, ...points.map((p) => p.value));
    const peak = points.reduce(
        (best, p, i) => (p.value > (points[best]?.value ?? 0) ? i : best),
        0,
    );
    const x = (i: number) => PAD_X + i * slot + slot / 2;
    const y = (v: number) => PAD_TOP + (1 - v / max) * (height - PAD_TOP - PAD_BOTTOM);
    const bottom = height - PAD_BOTTOM;

    useEffect(() => {
        const el = scroll.current;
        if (el) el.scrollLeft = Math.max(0, x(peak) - el.clientWidth / 2);
        // Once per data: a re-render must not move what the user scrolled to.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points]);

    if (points.length === 0) return null;
    const line = path(
        points.map((p, i) => [x(i), y(p.value)] as const),
        shape,
        slot,
    );
    const area = `${line} L${x(points.length - 1) + (shape === "step" ? slot / 2 : 0)},${bottom} L${x(0) - (shape === "step" ? slot / 2 : 0)},${bottom} Z`;
    const tip = picked !== null ? points[picked] : null;

    return (
        <div ref={scroll} className="overflow-x-auto no-scrollbar text-brand">
            <div className="relative" style={{ width }}>
                <svg
                    width={width}
                    height={height}
                    role="img"
                    // A finger lifting also "leaves": only a mouse moving away hides the tooltip.
                    onPointerLeave={(e) => e.pointerType === "mouse" && setPicked(null)}
                    className="block select-none"
                >
                    {points.map((p, i) => (
                        <line
                            key={p.key}
                            x1={x(i)}
                            x2={x(i)}
                            y1={PAD_TOP - 8}
                            y2={bottom}
                            stroke="#e5e7eb"
                            strokeDasharray="3 3"
                        />
                    ))}
                    <path d={area} fill="currentColor" fillOpacity={0.14} />
                    <path
                        d={line}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                    />
                    {points.map((p, i) =>
                        p.value > 0 ? (
                            <text
                                key={p.key}
                                x={x(i)}
                                y={y(p.value) - 8}
                                textAnchor="middle"
                                fontSize={10}
                                fontWeight={i === peak ? 700 : 400}
                                fill="#111827"
                            >
                                {format(p.value)}
                            </text>
                        ) : null,
                    )}
                    {points.map((p, i) => (
                        <text
                            key={p.key}
                            x={x(i)}
                            y={height - 6}
                            textAnchor="middle"
                            fontSize={9}
                            fill="#9ca3af"
                        >
                            {p.label}
                        </text>
                    ))}
                    {tip && picked !== null && (
                        <line
                            x1={x(picked)}
                            x2={x(picked)}
                            y1={PAD_TOP - 8}
                            y2={bottom}
                            stroke="currentColor"
                            strokeDasharray="3 3"
                        />
                    )}
                    {/* Taps land on a whole column, not on a thin line. */}
                    {points.map((p, i) => (
                        <rect
                            key={p.key}
                            x={PAD_X + i * slot}
                            y={0}
                            width={slot}
                            height={height}
                            fill="transparent"
                            onPointerDown={() => setPicked(i)}
                        />
                    ))}
                </svg>
                {tip && picked !== null && (
                    <div
                        className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs shadow-md whitespace-nowrap"
                        style={{ left: Math.min(Math.max(x(picked), 50), width - 50) }}
                    >
                        <p className="font-semibold text-gray-700">{tip.label}</p>
                        <p className="font-bold text-brand">
                            {format(tip.value)}
                            {unit ? ` ${unit}` : ""}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

/** The line through the points: straight, or level at each value and changing halfway. */
function path(pts: (readonly [number, number])[], shape: "step" | "line", slot: number): string {
    if (shape === "line") return pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
    const half = slot / 2;
    return pts
        .map(([px, py], i) => `${i ? "L" : "M"}${px - half},${py} L${px + half},${py}`)
        .join(" ");
}
