// The /api forwarder every app runs as a Pages Function: the app and its API share one address.

export interface Env {
    API_ORIGIN: string;
    EDGE_SECRET: string;
}

export async function forward(request: Request, env: Env): Promise<Response> {
    if (!env.API_ORIGIN || !env.EDGE_SECRET) {
        return new Response("API_ORIGIN or EDGE_SECRET is not set", { status: 500 });
    }
    const url = new URL(request.url);
    // Only the path is set, so no path (e.g. //other.host) can change where it goes.
    const target = new URL(env.API_ORIGIN);
    target.pathname = url.pathname.replace(/^\/api/, "") || "/";
    target.search = url.search;

    // set() replaces anything a client sent under these names.
    const headers = new Headers(request.headers);
    headers.set("X-Edge-Secret", env.EDGE_SECRET);
    headers.set("X-Client-IP", request.headers.get("CF-Connecting-IP") ?? "");
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
