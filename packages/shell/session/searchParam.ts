import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/** Merges into the address's search (`''` removes a key), replacing the entry, never adding one. */
export function useSetSearch(): (patch: Record<string, string>) => void {
    const navigate = useNavigate();
    return (patch) =>
        void navigate({
            to: ".",
            replace: true,
            search: ((prev: Record<string, unknown>) => {
                const next = { ...prev };
                for (const [k, v] of Object.entries(patch)) next[k] = v === "" ? undefined : v;
                return next;
            }) as never,
        });
}

/**
 * A screen's state kept in its address (`?q=budi`), so back, a reload or a shared link brings
 * it back: the value ('' when absent) and its setter.
 */
export function useSearchParam(key: string): [string, (value: string) => void] {
    const raw = useSearch({ strict: false, select: (s) => (s as Record<string, unknown>)[key] });
    const set = useSetSearch();
    return [raw === undefined || raw === null ? "" : String(raw), (v) => set({ [key]: v })];
}

/** A search box's text: typed into local state (no keystroke waits on the router), copied to `?key=`. */
export function useSearchText(key = "q"): [string, (value: string) => void] {
    const [saved, save] = useSearchParam(key);
    const [text, setText] = useState(saved);
    useEffect(() => {
        if (text.trim() === saved) return;
        const id = setTimeout(() => save(text.trim()), 300);
        return () => clearTimeout(id);
    }, [text, saved, save]);
    return [text, setText];
}
