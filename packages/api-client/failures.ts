/** A request that failed, as the error sheet shows it: enough to find it in Go's logs. */
export interface Failure {
    at: string;
    method: string;
    path: string;
    status?: number;
    code?: string;
    message?: string;
    requestId?: string;
}

const recent: Failure[] = [];

export function recordFailure(failure: Failure) {
    recent.unshift(failure);
    recent.length = Math.min(recent.length, 10);
}

/** The newest failure that produced `error`: its code and status, or no answer at all. */
export function failureFor(error: unknown): Failure | undefined {
    const e = error as { code?: string; status?: number } | null;
    if (error instanceof Error || !e?.code) return recent.find((f) => f.status === undefined);
    return recent.find(
        (f) => f.code === e.code && (e.status === undefined || f.status === e.status),
    );
}
