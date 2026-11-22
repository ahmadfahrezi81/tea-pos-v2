/// <reference lib="webworker" />
// The app's service worker, for every app. Workbox serves the saved files and cleans up old ones;
// the install is ours: Workbox saves an update's files one at a time (about 130, so tens of
// seconds on a phone), this saves them several at a time and skips what is already saved.
import { cleanupOutdatedCaches, PrecacheController, PrecacheRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: { url: string; revision: string | null }[];
};

/** How many files download at once: enough to hide a phone's round trip, few enough for its memory. */
const AT_ONCE = 8;

const precache = new PrecacheController();
precache.addToCacheList(self.__WB_MANIFEST);

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(precache.strategy.cacheName);
            const entries = [...precache.getURLsToCacheKeys()];
            let next = 0;
            const worker = async () => {
                while (next < entries.length) {
                    const [url, key] = entries[next++]!;
                    if (await cache.match(key)) continue;
                    // A file named by its content is safe from the browser's cache; index.html and the like are not.
                    const response = await fetch(url, {
                        cache: key.includes("__WB_REVISION__") ? "reload" : "default",
                        credentials: "same-origin",
                    });
                    if (!response.ok) throw new Error(`precache ${url}: ${response.status}`);
                    // Pages redirects /index.html to /; a redirected answer cannot open a screen, so save a copy.
                    await cache.put(
                        key,
                        response.redirected
                            ? new Response(await response.blob(), {
                                  headers: response.headers,
                                  status: response.status,
                                  statusText: response.statusText,
                              })
                            : response,
                    );
                }
            };
            await Promise.all(Array.from({ length: AT_ONCE }, worker));
        })(),
    );
});

self.addEventListener("activate", (event) => {
    // Drops files the new build no longer lists, and caches of older Workbox versions.
    event.waitUntil(precache.activate(event));
});
cleanupOutdatedCaches();

// AppUpdate tells the waiting worker when to take over; never on its own (a reload mid-order drops the cart).
self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

registerRoute(new PrecacheRoute(precache));

/** The last resort, with no saved copy and no network: a page that says so and tries again. */
function offline() {
    const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:16px system-ui;margin:0;display:grid;place-items:center;height:100vh;text-align:center;padding:0 24px"><div><p>No connection right now.<br>Tidak ada koneksi.</p><p><a href="" onclick="location.reload();return false" style="display:inline-block;padding:12px 24px;border-radius:12px;background:#111;color:#fff;text-decoration:none">Try again · Coba lagi</a></p></div>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// Every screen is index.html, saved; if the saved copy cannot answer (an update half done), the
// network does, never the browser's error page (task 077: a tapped notification showed ERR_FAILED).
const appShell = precache.createHandlerBoundToURL("/index.html");
registerRoute(
    new NavigationRoute(
        async (options) => {
            try {
                return await appShell(options);
            } catch {
                try {
                    return await fetch(options.request);
                } catch {
                    return offline();
                }
            }
        },
        { denylist: [/^\/api\//] },
    ),
);

// Chat's notifications (Step 68): one line per channel that updates (the tag), not one per message.
self.addEventListener("push", (event) => {
    const m = (event.data?.json() ?? {}) as {
        title?: string;
        body?: string;
        tag?: string;
        url?: string;
        icon?: string;
    };
    event.waitUntil(
        self.registration.showNotification(m.title ?? "", {
            body: m.body,
            tag: m.tag,
            // An update to a channel's line does not buzz again.
            renotify: false,
            // The sender's photo where the phone shows one (Android); iOS always shows the app's.
            icon: m.icon || "/icons/icon-192x192.png",
            badge: "/icons/badge-96x96.png",
            data: { url: m.url ?? "/" },
        } as NotificationOptions),
    );
});

// A tap opens the chat: in the app's open window if there is one, else a new one.
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = new URL(
        (event.notification.data as { url?: string })?.url ?? "/",
        self.location.origin,
    ).href;
    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
            if (open) {
                // The open app changes screen itself (shell's startApp): no reload, which failed
                // on a Samsung M11 with ERR_FAILED (task 077).
                await open.focus().catch(() => {});
                return open.postMessage({ type: "OPEN", url });
            }
            await self.clients.openWindow(url);
        })(),
    );
});
