import { ImageOff } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

interface PictureProps {
    src: string;
    alt?: string;
    /** The box: size and rounding. The picture fills it. */
    className?: string;
    style?: CSSProperties;
    fit?: "cover" | "contain";
    /** Shown when it fails to load; a faint picture icon by default. */
    fallback?: ReactNode;
    referrerPolicy?: "no-referrer";
}

/**
 * Every picture from the network: the skeleton's pulse while it loads, a quiet placeholder if it
 * fails (never iOS's "?" box), and another try once the phone is back online.
 */
export function Picture(props: PictureProps) {
    return <Loaded key={props.src} {...props} />;
}

function Loaded({
    src,
    alt = "",
    className = "",
    style,
    fit = "cover",
    fallback,
    referrerPolicy,
}: PictureProps) {
    const [state, setState] = useState<"loading" | "done" | "failed">("loading");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (state !== "failed") return;
        const retry = () => {
            setAttempt((n) => n + 1);
            setState("loading");
        };
        window.addEventListener("online", retry);
        return () => window.removeEventListener("online", retry);
    }, [state]);

    return (
        <span
            className={`relative block shrink-0 overflow-hidden ${state === "loading" ? "skeleton" : ""} ${className}`}
            style={style}
        >
            {state === "failed" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
                    {fallback ?? <ImageOff size={20} />}
                </span>
            ) : (
                <img
                    key={attempt}
                    src={src}
                    alt={alt}
                    referrerPolicy={referrerPolicy}
                    draggable={false}
                    onLoad={() => setState("done")}
                    onError={() => setState("failed")}
                    className={`size-full ${fit === "cover" ? "object-cover" : "object-contain"} ${state === "done" ? "" : "opacity-0"}`}
                />
            )}
        </span>
    );
}
