import { shrinkCore } from "./shrink-core";

// Shrinking a 12-megapixel photo takes a while on a slow phone: here, the screen never waits.
self.onmessage = async (e: MessageEvent<Blob>) => {
    try {
        const blob = await shrinkCore(e.data, (w, h) => new OffscreenCanvas(w, h));
        self.postMessage({ blob });
    } catch (err) {
        self.postMessage({ error: String(err) });
    }
};
