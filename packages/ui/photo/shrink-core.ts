// The old app's settings (apps/*/lib/compressPhoto.ts): small enough for slow 4G and the bucket.
export const MAX_SIDE = 1080;
export const MAX_BYTES = 400_000;
const WEBP_QUALITY = 0.6;
const JPEG_QUALITY = 0.7;
const LOWEST_QUALITY = 0.3;
// Wider than 4:3 or taller than 3:4 is cropped to it (panoramas break the review screens).
const MAX_ASPECT = 4 / 3;
const MIN_ASPECT = 3 / 4;

type Canvas = OffscreenCanvas | HTMLCanvasElement;

async function encode(canvas: Canvas, type: string, quality: number): Promise<Blob | null> {
    if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality }).catch(() => null);
    return new Promise((done) => canvas.toBlob(done, type, quality));
}

/**
 * Turns a camera photo into a WebP (or JPEG where WebP cannot be encoded, as on iOS) of at
 * most 1080 px on its longest side and about 0.4 MB, the right way up, cropped to 4:3 at
 * most. Works on the main thread or in a worker: `canvas` makes the drawing surface.
 */
export async function shrinkCore(
    file: Blob,
    canvas: (w: number, h: number) => Canvas,
): Promise<Blob> {
    // "from-image" applies the photo's own rotation, so a portrait stays a portrait.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
        let sw = bitmap.width;
        let sh = bitmap.height;
        if (sw / sh > MAX_ASPECT) sw = Math.round(sh * MAX_ASPECT);
        else if (sw / sh < MIN_ASPECT) sh = Math.round(sw / MIN_ASPECT);
        const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
        const w = Math.round(sw * scale);
        const h = Math.round(sh * scale);

        const c = canvas(w, h);
        const ctx = c.getContext("2d") as
            CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
        if (!ctx) throw new Error("no canvas");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
            bitmap,
            (bitmap.width - sw) / 2,
            (bitmap.height - sh) / 2,
            sw,
            sh,
            0,
            0,
            w,
            h,
        );

        let type = "image/webp";
        let quality = WEBP_QUALITY;
        let blob = await encode(c, type, quality);
        // A browser that cannot encode WebP hands back a PNG: use JPEG instead.
        if (!blob || blob.type !== "image/webp") {
            type = "image/jpeg";
            quality = JPEG_QUALITY;
            blob = await encode(c, type, quality);
        }
        while (blob && blob.size > MAX_BYTES && quality > LOWEST_QUALITY) {
            quality -= 0.1;
            blob = await encode(c, type, quality);
        }
        if (!blob) throw new Error("the photo could not be encoded");
        return blob;
    } finally {
        bitmap.close();
    }
}
