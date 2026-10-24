// The /api forwarder every app runs as a Pages Function: the app and its API share one address.

export interface Env {
    API_ORIGIN: string;
    /** The realtime service (the WebSocket hub), for /api/realtime. */
    REALTIME_ORIGIN?: string;
    EDGE_SECRET: string;
    /** Which app this Pages project is: "seller" or "backoffice". */
    APP: string;
}

export async function forward(request: Request, env: Env): Promise<Response> {
    if (!env.API_ORIGIN || !env.EDGE_SECRET || !env.APP) {
        return new Response("API_ORIGIN, EDGE_SECRET or APP is not set", { status: 500 });
    }
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "") || "/";
    // The hub is its own service; its socket passes through like any request.
    const realtime = path === "/realtime";
    if (realtime && !env.REALTIME_ORIGIN) {
        return new Response("REALTIME_ORIGIN is not set", { status: 500 });
    }
    // Only the path is set, so no path (e.g. //other.host) can change where it goes.
    const target = new URL(realtime ? env.REALTIME_ORIGIN! : env.API_ORIGIN);
    target.pathname = path;
    target.search = url.search;

    // set() replaces anything a client sent under these names.
    const headers = new Headers(request.headers);
    headers.set("X-Edge-Secret", env.EDGE_SECRET);
    headers.set("X-Client-IP", request.headers.get("CF-Connecting-IP") ?? "");
    // Which app is calling, and the address the user sees (a preview's own), for sign-in redirects.
    headers.set("X-App", env.APP);
    headers.set("X-App-Origin", url.origin);
    headers.delete("Host");

    return fetch(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
    });
}

export const onRequest = ({ request, env }: { request: Request; env: Env }) =>
    forward(request, env);
