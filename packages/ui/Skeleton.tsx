import type { CSSProperties, ReactNode } from "react";

/**
 * A placeholder for content that has not arrived. The sweep lives in globals.css (`.skeleton`);
 * `delay` staggers rows so a list does not flash as one block.
 */
export function Skeleton({
    className = "",
    delay = 0,
    style,
}: {
    className?: string;
    delay?: number;
    style?: CSSProperties;
}) {
    return (
        <div
            aria-hidden
            className={`skeleton rounded-md ${className}`}
            style={
                delay ? ({ ...style, "--skeleton-delay": `${delay}ms` } as CSSProperties) : style
            }
        />
    );
}

/** Lines of text; the last one short, as real paragraphs end mid-line. */
export function SkeletonText({
    lines = 3,
    className = "h-3.5",
    delay = 0,
}: {
    lines?: number;
    className?: string;
    delay?: number;
}) {
    return (
        <div className="space-y-2">
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    delay={delay + i * 80}
                    className={`${className} ${i === lines - 1 ? "w-2/3" : "w-full"}`}
                />
            ))}
        </div>
    );
}

/** One figure in place, inline so it sits in a line of real text. */
export function SkeletonValue({
    loading,
    children,
    className = "h-6 w-12",
}: {
    loading: boolean;
    children: ReactNode;
    className?: string;
}) {
    if (!loading) return <>{children}</>;
    return (
        <span
            aria-hidden
            className={`skeleton inline-block rounded-md align-middle ${className}`}
        />
    );
}

// A fixed pattern, so the placeholder does not jitter on every render.
const BAR_HEIGHTS = [45, 70, 35, 85, 55, 95, 40, 75, 60, 30, 80, 50];

/** A chart's placeholder: bars of uneven height, not a grey slab. */
export function SkeletonChart({ height = 220, bars = 12 }: { height?: number; bars?: number }) {
    return (
        <div aria-hidden className="flex items-end justify-between gap-1.5 px-1" style={{ height }}>
            {Array.from({ length: bars }).map((_, i) => (
                <Skeleton
                    key={i}
                    delay={i * 70}
                    className="flex-1 rounded-t-md rounded-b-sm"
                    style={{ height: `${BAR_HEIGHTS[i % BAR_HEIGHTS.length]}%` }}
                />
            ))}
        </div>
    );
}
