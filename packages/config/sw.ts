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
registerRoute(
    new NavigationRoute(precache.createHandlerBoundToURL("/index.html"), {
        denylist: [/^\/api\//],
    }),
);
