import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";

/** A page as every list route answers (Go's page.Output). */
export interface Page<T> {
    items: T[];
    next?: string;
}

/**
 * A list a page at a time (Go's cursor paging, 017e), its rows flattened for the screen and
 * saved on the phone like every query. `meta.live` names the kinds of change (017b) that refetch it.
 */
export function useInfiniteList<T>(
    queryKey: QueryKey,
    fetchPage: (cursor: string) => Promise<Page<T>>,
    live: readonly string[] = [],
) {
    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => fetchPage(pageParam),
        initialPageParam: "",
        getNextPageParam: (last) => last.next || undefined,
        select: (data) => data.pages.flatMap((p) => p.items),
        meta: { live },
    });
}
