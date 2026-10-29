// When the app last refetched everything. Outside React: a timestamp is not
// render state. Pull to refresh refetches every cached screen, so it needs its
// own limit, or a fast thumb sends the same requests again and again.

/** How long a pull waits before it may fetch again. */
export const PULL_MIN_INTERVAL_MS = 30_000;

// performance.now() is monotonic: a clock correction cannot lock the gesture out.
let lastAt = 0;

export const refreshGate = {
    shouldFetch: () => performance.now() - lastAt >= PULL_MIN_INTERVAL_MS,
    /** Every full refetch marks, including the idle sheet's, which is never gated. */
    mark: () => {
        lastAt = performance.now();
    },
};
