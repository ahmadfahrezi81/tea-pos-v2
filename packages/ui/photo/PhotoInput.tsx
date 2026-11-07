import { CircleMinus, RotateCcw } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { ImagePreview } from "../feedback/ImagePreview";
import { Picture } from "../feedback/Picture";

type State =
    | { at: "idle" }
    | { at: "shrinking" }
    | { at: "uploading"; progress: number }
    | { at: "done"; preview: string }
    | { at: "failed"; photo: Blob };

/**
 * Takes a photo, shrinks it on the phone and uploads it, showing where it is. Once in, it shows on
 * black (a tap opens it full screen) with Retake and Remove below it, never on it. `upload` is the
 * caller's (api-client's uploadPhoto with the screen's purpose); the shrinking code loads only
 * when a photo is taken.
 */
export function PhotoInput({
    upload,
    onRemove,
    children,
    failedLabel,
    retakeLabel,
    removeLabel,
    title = "",
    screenshot = false,
    preview,
}: {
    upload: (photo: Blob, onProgress: (fraction: number) => void) => Promise<unknown>;
    /** The photo was removed, or a new one is being taken: the caller forgets the old one. */
    onRemove: () => void;
    /** What the empty tile says (already translated). */
    children: ReactNode;
    /** What a failed upload says, tap to try again (already translated). */
    failedLabel: ReactNode;
    retakeLabel: string;
    removeLabel: string;
    /** The full screen view's title (already translated). */
    title?: string;
    /** A screenshot (a transfer receipt): from the gallery, never cropped. */
    screenshot?: boolean;
    /** A photo already saved: shown until another is taken. */
    preview?: string;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<State>(preview ? { at: "done", preview } : { at: "idle" });
    const [open, setOpen] = useState(false);

    const send = async (photo: Blob) => {
        setState({ at: "uploading", progress: 0 });
        try {
            await upload(photo, (progress) => setState({ at: "uploading", progress }));
            setState({ at: "done", preview: URL.createObjectURL(photo) });
        } catch {
            setState({ at: "failed", photo });
        }
    };

    const take = async (file: File | undefined) => {
        if (!file) return;
        onRemove();
        setState({ at: "shrinking" });
        const { shrinkPhoto } = await import("./shrink");
        try {
            await send(await shrinkPhoto(file, !screenshot));
        } catch {
            setState({ at: "idle" });
        }
    };

    const busy = state.at === "shrinking" || state.at === "uploading";
    const button =
        "flex items-center justify-center gap-2 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-900 active:opacity-70 disabled:opacity-50";

    return (
        <div className="space-y-2">
            <button
                type="button"
                disabled={busy}
                className={`relative flex aspect-[2/1] w-full items-center justify-center overflow-hidden rounded-xl text-sm text-gray-500 ${
                    state.at === "done"
                        ? "bg-black"
                        : "border border-dashed border-gray-300 bg-gray-50"
                }`}
                onClick={() =>
                    state.at === "done"
                        ? setOpen(true)
                        : state.at === "failed"
                          ? void send(state.photo)
                          : input.current?.click()
                }
            >
                {state.at === "done" ? (
                    <Picture
                        src={state.preview}
                        alt={title}
                        fit="contain"
                        className="size-full bg-black"
                    />
                ) : state.at === "failed" ? (
                    failedLabel
                ) : state.at === "idle" ? (
                    children
                ) : (
                    <span className="h-1 w-2/3 overflow-hidden rounded-full bg-gray-200">
                        <span
                            className="block h-full bg-brand transition-[width]"
                            style={{
                                width: `${state.at === "uploading" ? Math.round(state.progress * 100) : 5}%`,
                            }}
                        />
                    </span>
                )}
            </button>
            {(state.at === "done" || state.at === "failed") && (
                <div className="grid grid-cols-2 gap-2">
                    <button type="button" className={button} onClick={() => input.current?.click()}>
                        <RotateCcw size={18} strokeWidth={2.5} />
                        {retakeLabel}
                    </button>
                    <button
                        type="button"
                        className={button}
                        onClick={() => {
                            onRemove();
                            setState({ at: "idle" });
                        }}
                    >
                        <CircleMinus size={18} strokeWidth={2.5} />
                        {removeLabel}
                    </button>
                </div>
            )}
            <input
                ref={input}
                type="file"
                accept="image/*"
                capture={screenshot ? undefined : "environment"}
                className="hidden"
                onChange={(e) => {
                    void take(e.target.files?.[0]);
                    e.target.value = "";
                }}
            />
            {state.at === "done" && (
                <ImagePreview
                    open={open}
                    onClose={() => setOpen(false)}
                    src={state.preview}
                    title={title}
                />
            )}
        </div>
    );
}
