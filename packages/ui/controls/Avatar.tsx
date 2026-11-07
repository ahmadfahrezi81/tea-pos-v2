import { UserCircle } from "lucide-react";

import { Picture } from "../feedback/Picture";
import { avatar } from "../lib/avatarUrl";

// The header's avatar (12 px on 42 px), in proportion: the same look at every size.
const shape = "rounded-[28.6%]";

/** A person's photo, or a placeholder; one shape everywhere. */
export function Avatar({ url, size = 36 }: { url?: string | null; size?: number }) {
    const style = { width: size, height: size };
    const placeholder = (
        <span
            className={`${shape} flex size-full shrink-0 items-center justify-center bg-brand/10`}
            style={style}
        >
            <UserCircle size={Math.round(size * 0.6)} className="text-brand" />
        </span>
    );
    return url ? (
        <Picture
            src={avatar(url)}
            referrerPolicy="no-referrer"
            className={shape}
            style={style}
            fallback={placeholder}
        />
    ) : (
        placeholder
    );
}
