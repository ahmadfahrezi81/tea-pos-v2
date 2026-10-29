import { shrinkCore } from "./shrink-core";

/** A photo ready to upload: shrunk off the main thread where the browser can, on it where not. */
export async function shrinkPhoto(file: Blob, crop = true): Promise<Blob> {
    if (typeof OffscreenCanvas !== "undefined" && typeof Worker !== "undefined") {
        try {
            return await inWorker(file, crop);
        } catch {
            // A worker that cannot decode this photo (rare): try on the main thread.
        }
    }
    return shrinkCore(
        file,
        (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }),
        crop,
    );
}

function inWorker(file: Blob, crop: boolean): Promise<Blob> {
    const worker = new Worker(new URL("./shrink.worker.ts", import.meta.url), { type: "module" });
    return new Promise<Blob>((done, fail) => {
        worker.onmessage = (e: MessageEvent<{ blob?: Blob; error?: string }>) =>
            e.data.blob ? done(e.data.blob) : fail(new Error(e.data.error));
        worker.onerror = () => fail(new Error("worker failed"));
        worker.postMessage({ file, crop });
    }).finally(() => worker.terminate());
}
