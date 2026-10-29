import { useT } from "@tea-pos/i18n/react";
import { ArrowLeft, UserCircle } from "lucide-react";

interface MobileHeaderProps {
    title: string;
    isSubPage: boolean;
    avatarUrl: string | null;
    showAccountIcon: boolean;
    onBack: () => void;
    onAccount?: () => void;
    /** The right slot, filled by the screen's HeaderActions. */
    actionsRef: (el: HTMLDivElement | null) => void;
    /** Where a screen's HeaderTitle goes; while filled, the route's title hides. */
    titleRef: (el: HTMLSpanElement | null) => void;
}

/**
 * A tab's home: the big title on the left, the avatar (Account) on the right; actions live in the page.
 * A screen under it: back, then the title on one line, the actions on the right.
 */
export function MobileHeader({
    title,
    isSubPage,
    avatarUrl,
    showAccountIcon,
    onBack,
    onAccount,
    actionsRef,
    titleRef,
}: MobileHeaderProps) {
    const t = useT();
    const titleText = (
        <>
            <span className="group-has-[.is-occupied]:hidden">{title}</span>
            <span ref={titleRef} />
        </>
    );
    return (
        <header className="shrink-0 bg-slate-100 px-4 py-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))]">
            {isSubPage ? (
                <div className="flex items-center gap-2">
                    <button
                        onClick={onBack}
                        className="shrink-0 text-gray-900 active:scale-95 py-1"
                        aria-label={t("common.back")}
                    >
                        <ArrowLeft size={30} strokeWidth={2.5} />
                    </button>
                    <h1 className="group min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-gray-900">
                        {titleText}
                    </h1>
                    <div
                        ref={actionsRef}
                        className="flex shrink-0 items-center justify-end gap-1"
                    />
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <h1 className="group min-w-0 flex-1 truncate text-3xl font-extrabold tracking-tight text-gray-900">
                        {titleText}
                    </h1>
                    <div
                        ref={actionsRef}
                        className="flex shrink-0 items-center justify-end gap-1"
                    />
                    {showAccountIcon && (
                        <button
                            onClick={onAccount}
                            className="shrink-0 active:scale-95"
                            aria-label={t("shell.account")}
                        >
                            {avatarUrl ? (
                                <div className="w-[42px] h-[42px] rounded-xl overflow-hidden ring-1 ring-black/10">
                                    <img
                                        src={avatarUrl}
                                        alt=""
                                        width={42}
                                        height={42}
                                        className="object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="w-[42px] h-[42px] rounded-xl bg-gray-100 ring-1 ring-black/10 flex items-center justify-center">
                                    <UserCircle size={25} className="text-gray-600" />
                                </div>
                            )}
                        </button>
                    )}
                </div>
            )}
        </header>
    );
}
