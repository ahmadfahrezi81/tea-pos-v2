import { UserCircle } from "lucide-react";

import { avatar } from "./avatarUrl";

/** A person's photo, or a placeholder; one look in every list (round) or card (square). */
export function Avatar({
    url,
    size = 36,
    square = false,
}: {
    url?: string | null;
    size?: number;
    square?: boolean;
}) {
    const shape = square
        ? size >= 48
            ? "rounded-2xl"
            : size >= 32
              ? "rounded-xl"
              : "rounded-lg"
        : "rounded-full";
    const style = { width: size, height: size };
    return url ? (
        <img
            src={avatar(url)}
            alt=""
            width={size}
            height={size}
            referrerPolicy="no-referrer"
            className={`${shape} shrink-0 object-cover`}
            style={style}
        />
    ) : (
        <span
            className={`${shape} flex shrink-0 items-center justify-center bg-brand/10`}
            style={style}
        >
            <UserCircle size={Math.round(size * 0.6)} className="text-brand" />
        </span>
    );
}
