import { api, type components } from "./index";

type Purpose = components["schemas"]["UploadInputBody"]["purpose"];

export interface Uploaded {
    /** Where it is kept, for the row that refers to it. */
    path: string;
    /** The address saved in the row (the old app's form); a private photo opens through a signed one. */
    url: string;
}

const ATTEMPTS = 5;

/**
 * Uploads a shrunk photo (packages/ui shrinkPhoto) straight to Storage: Go signs an address,
 * the phone PUTs to it. A dropped connection is tried again, slower each time, for about
 * half a minute; each try asks for a fresh address, since one only works for a few minutes.
 */
export async function uploadPhoto(
    to: { tenant: string; purpose: Purpose; storeId?: string },
    photo: Blob,
    onProgress?: (fraction: number) => void,
): Promise<Uploaded> {
    const contentType = photo.type === "image/webp" ? "image/webp" : "image/jpeg";
    let lastError: unknown;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
        try {
            const { data, error } = await api.POST("/tenants/{tenant}/files", {
                params: { path: { tenant: to.tenant } },
                body: { purpose: to.purpose, contentType, size: photo.size, storeId: to.storeId },
            });
            // An answer that will not change (not allowed, no such store) is not tried again.
            if (error && error.status < 500) return Promise.reject(new Error(error.code));
            if (!data) {
                lastError = error;
                continue;
            }
            await put(data.uploadUrl, photo, contentType, onProgress);
            return { path: data.path, url: data.url };
        } catch (e) {
            // No connection at all (fetch throws), or the PUT failed.
            lastError = e;
        }
    }
    throw lastError instanceof Error ? lastError : new Error("upload_failed");
}

/** XMLHttpRequest, not fetch: only it reports upload progress. */
function put(url: string, body: Blob, type: string, onProgress?: (f: number) => void) {
    return new Promise<void>((done, fail) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", type);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
        xhr.onload = () => (xhr.status < 300 ? done() : fail(new Error(`upload ${xhr.status}`)));
        xhr.onerror = () => fail(new Error("network"));
        xhr.ontimeout = () => fail(new Error("timeout"));
        xhr.timeout = 60_000;
        xhr.send(body);
    });
}
