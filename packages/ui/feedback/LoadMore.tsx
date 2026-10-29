import { useEffect, useRef } from "react";

/**
 * The end of a list: fetches the next page as it scrolls into view (a button too, for when
 * the observer is late on a slow phone). Renders nothing on the last page.
 */
export function LoadMore({
    hasMore,
    loading,
    onMore,
    label,
}: {
    hasMore: boolean;
    loading: boolean;
    onMore: () => void;
    /** "Load more", already translated. */
    label: string;
}) {
    const end = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const el = end.current;
        if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting) && !loading) onMore();
        });
        io.observe(el);
        return () => io.disconnect();
    }, [hasMore, loading, onMore]);
    if (!hasMore) return null;
    return (
        <button
            ref={end}
            onClick={onMore}
            disabled={loading}
            className="w-full py-4 text-sm font-semibold text-gray-500 disabled:opacity-50"
        >
            {label}
        </button>
    );
}
