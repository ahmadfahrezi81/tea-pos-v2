import { afterEach, describe, expect, it, vi } from "vitest";
import { forward } from "./index";

const env = { API_ORIGIN: "https://api.example", EDGE_SECRET: "secret" };

function sent(path: string, headers: Record<string, string> = {}) {
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    return forward(new Request("https://app.example" + path, { headers }), env).then(() => {
        const [target, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
        return { target, headers: new Headers(init.headers) };
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("forward", () => {
    it("drops /api and keeps the query", async () => {
        const { target } = await sent("/api/health?x=1");
        expect(target.href).toBe("https://api.example/health?x=1");
    });

    it.each(["/api//evil.example/x", "/api/%5C%5Cevil.example/x", "/api/\\\\evil.example/x"])(
        "never leaves API_ORIGIN's host: %s",
        async (path) => {
            const { target } = await sent(path);
            expect(target.host).toBe("api.example");
        },
    );

    it("sets the secret and replaces a client's own", async () => {
        const { headers } = await sent("/api/me", {
            "X-Edge-Secret": "forged",
            "CF-Connecting-IP": "203.0.113.7",
        });
        expect(headers.get("X-Edge-Secret")).toBe("secret");
        expect(headers.get("X-Client-IP")).toBe("203.0.113.7");
    });
});
