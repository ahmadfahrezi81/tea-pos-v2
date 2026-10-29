/** Runs `fn` once the browser is idle (soon after the first screen), or after `timeout`. */
export function whenIdle(fn: () => void, timeout = 3000): () => void {
    if (typeof requestIdleCallback === "function") {
        const handle = requestIdleCallback(fn, { timeout });
        return () => cancelIdleCallback(handle);
    }
    const handle = setTimeout(fn, 1000);
    return () => clearTimeout(handle);
}
