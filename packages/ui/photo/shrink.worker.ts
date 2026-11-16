import { shrinkCore } from "./shrink-core";

// Shrinking a 12-megapixel photo takes a while on a slow phone: here, the screen never waits.
self.onmessage = async (e: MessageEvent<{ file: Blob; crop: boolean; maxSide?: number }>) => {
    try {
        const blob = await shrinkCore(
            e.data.file,
            (w, h) => new OffscreenCanvas(w, h),
            e.data.crop,
            e.data.maxSide,
        );
        self.postMessage({ blob });
    } catch (err) {
        self.postMessage({ error: String(err) });
    }
};
