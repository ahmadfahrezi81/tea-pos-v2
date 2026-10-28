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
 * One bar, three slots, on every screen: left the back button (on a tab's home,
 * the avatar), centre the title on one line, right the screen's actions. The
 * sides are equal widths, so the title stays centred.
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
    return (
        <header className="shrink-0 bg-slate-100 px-4 py-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))]">
            <div className="grid grid-cols-[5.25rem_minmax(0,1fr)_5.25rem] items-center gap-1">
                <div className="flex justify-start">
                    {isSubPage ? (
                        <button
                            onClick={onBack}
                            className="text-gray-900 active:scale-95 py-1"
                            aria-label={t("common.back")}
                        >
                            <ArrowLeft size={30} strokeWidth={2.5} />
                        </button>
                    ) : (
                        showAccountIcon && (
                            <button
                                onClick={onAccount}
                                className="active:scale-95"
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
                        )
                    )}
                </div>
                <h1 className="group truncate text-center text-xl font-extrabold tracking-tight text-gray-900">
                    <span className="group-has-[.is-occupied]:hidden">{title}</span>
                    <span ref={titleRef} />
                </h1>
                <div ref={actionsRef} className="flex items-center justify-end gap-1" />
            </div>
        </header>
    );
}
