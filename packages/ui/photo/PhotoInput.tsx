import { useRef, useState, type ReactNode } from "react";

type State =
    | { at: "idle" }
    | { at: "shrinking" }
    | { at: "uploading"; progress: number }
    | { at: "done"; preview: string }
    | { at: "failed"; photo: Blob };

/**
 * Takes a photo, shrinks it on the phone and uploads it, showing where it is. `upload` is the
 * caller's (api-client's uploadPhoto with the screen's purpose); the shrinking code loads only
 * when a photo is taken.
 */
export function PhotoInput({
    upload,
    children,
    failedLabel,
    screenshot = false,
}: {
    upload: (photo: Blob, onProgress: (fraction: number) => void) => Promise<unknown>;
    /** What the empty tile says (already translated). */
    children: ReactNode;
    /** What a failed upload says, tap to try again (already translated). */
    failedLabel: ReactNode;
    /** A screenshot (a transfer receipt): from the gallery, never cropped. */
    screenshot?: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<State>({ at: "idle" });

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
        setState({ at: "shrinking" });
        const { shrinkPhoto } = await import("./shrink");
        try {
            await send(await shrinkPhoto(file, !screenshot));
        } catch {
            setState({ at: "idle" });
        }
    };

    return (
        <button
            type="button"
            className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500"
            onClick={() =>
                state.at === "failed" ? void send(state.photo) : input.current?.click()
            }
        >
            {state.at === "done" ? (
                <img src={state.preview} alt="" className="h-full w-full object-cover" />
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
            <input
                ref={input}
                type="file"
                accept="image/*"
                capture={screenshot ? undefined : "environment"}
                className="hidden"
                onChange={(e) => void take(e.target.files?.[0])}
            />
        </button>
    );
}
