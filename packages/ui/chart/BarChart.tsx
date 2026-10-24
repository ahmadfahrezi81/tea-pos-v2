import { useEffect, useRef, useState } from "react";

export interface BarPoint {
    key: string;
    label: string;
    value: number;
    /** The bar's colour; the brand colour when not set. */
    color?: string;
}

interface Props {
    points: BarPoint[];
    format?: (value: number) => string;
    unit?: string;
    /** A dashed line across at this value (a target). */
    line?: number;
    height?: number;
    slot?: number;
}

const PAD_TOP = 22;
const PAD_BOTTOM = 22;
const PAD_X = 16;

/** Values as columns, in plain SVG: AreaChart's look (labels, peak in bold, tooltip, scroll). */
export function BarChart({ points, format = String, unit, line, height = 200, slot = 56 }: Props) {
    const scroll = useRef<HTMLDivElement>(null);
    const [picked, setPicked] = useState<number | null>(null);
    const width = Math.max(points.length * slot + 2 * PAD_X, 280);
    const max = Math.max(1, line ?? 0, ...points.map((p) => p.value)) * 1.1;
    const peak = points.reduce(
        (best, p, i) => (p.value > (points[best]?.value ?? 0) ? i : best),
        0,
    );
    const x = (i: number) => PAD_X + i * slot + slot / 2;
    const y = (v: number) => PAD_TOP + (1 - v / max) * (height - PAD_TOP - PAD_BOTTOM);
    const bottom = height - PAD_BOTTOM;
    const bar = Math.min(36, slot * 0.6);

    useEffect(() => {
        const el = scroll.current;
        if (el) el.scrollLeft = Math.max(0, x(peak) - el.clientWidth / 2);
        // Once per data: a re-render must not move what the user scrolled to.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points]);

    if (points.length === 0) return null;
    const tip = picked !== null ? points[picked] : null;
    return (
        <div ref={scroll} className="overflow-x-auto no-scrollbar text-brand">
            <div className="relative" style={{ width }}>
                <svg width={width} height={height} role="img" className="block select-none">
                    {points.map((p, i) => (
                        <g key={p.key}>
                            {/* A 0 stays a sliver on the axis, not nothing. */}
                            <rect
                                x={x(i) - bar / 2}
                                y={Math.min(y(p.value), bottom - 2)}
                                width={bar}
                                height={Math.max(bottom - y(p.value), 2)}
                                rx={4}
                                fill={p.color ?? "currentColor"}
                                opacity={picked === null || picked === i ? 1 : 0.5}
                            />
                            <text
                                x={x(i)}
                                y={Math.min(y(p.value), bottom - 2) - 6}
                                textAnchor="middle"
                                fontSize={11}
                                fontWeight={i === peak ? 700 : 400}
                                fill="#111827"
                            >
                                {format(p.value)}
                            </text>
                            <text
                                x={x(i)}
                                y={height - 6}
                                textAnchor="middle"
                                fontSize={10}
                                fill="#9ca3af"
                            >
                                {p.label}
                            </text>
                        </g>
                    ))}
                    {line !== undefined && (
                        <line
                            x1={PAD_X}
                            x2={width - PAD_X}
                            y1={y(line)}
                            y2={y(line)}
                            stroke="#9ca3af"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                        />
                    )}
                    {points.map((p, i) => (
                        <rect
                            key={p.key}
                            x={PAD_X + i * slot}
                            y={0}
                            width={slot}
                            height={height}
                            fill="transparent"
                            onPointerDown={() => setPicked(picked === i ? null : i)}
                        />
                    ))}
                </svg>
                {tip && picked !== null && (
                    <div
                        className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs shadow-md whitespace-nowrap"
                        style={{ left: Math.min(Math.max(x(picked), 50), width - 50) }}
                    >
                        <p className="font-semibold text-gray-700">{tip.label}</p>
                        <p className="font-bold" style={{ color: tip.color }}>
                            {format(tip.value)}
                            {unit ? ` ${unit}` : ""}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
