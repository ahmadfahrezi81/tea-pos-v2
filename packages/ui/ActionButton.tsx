import { useRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";

interface ActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
    /** The write. Throwing marks it failed; returning `false` (a cancelled confirm) releases the button. */
    action: (event: MouseEvent<HTMLButtonElement>) => void | boolean | Promise<unknown>;
    /** Where a failure goes; without it the error is re-thrown, never swallowed. */
    onError?: (error: unknown) => void;
    /** Replaces the label while busy, only for a long wait worth explaining. */
    busyLabel?: ReactNode;
    /** Release on success. Off by default: most actions navigate, and a released button invites a second submit. */
    resetOnSuccess?: boolean;
    children: ReactNode;
}

/**
 * A button for a write: spins inside itself and refuses a second press. Busy is
 * an attribute written in the tap's own tick and drawn by CSS (`.action-*` in
 * globals.css), not React state, so a slow phone shows it at once. Keep it that way.
 */
export function ActionButton({
    action,
    onError,
    busyLabel,
    resetOnSuccess = false,
    className,
    children,
    type = "button",
    ...rest
}: ActionButtonProps) {
    const ref = useRef<HTMLButtonElement>(null);
    // A ref, not `disabled`: two taps can land before React commits.
    const inFlight = useRef(false);
    const disableFrame = useRef<number | null>(null);

    const setBusy = (busy: boolean) => {
        const el = ref.current;
        if (!el) return;

        if (busy) {
            el.setAttribute("data-busy", "true");
            el.setAttribute("aria-busy", "true");
            // Cosmetic, a frame later: disabling under a finger sticks iOS's :active style.
            disableFrame.current = requestAnimationFrame(() => {
                disableFrame.current = null;
                if (inFlight.current && ref.current) ref.current.disabled = true;
            });
            return;
        }

        if (disableFrame.current !== null) {
            cancelAnimationFrame(disableFrame.current);
            disableFrame.current = null;
        }
        el.removeAttribute("data-busy");
        el.removeAttribute("aria-busy");
        el.disabled = false;
    };

    const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);

        try {
            const result = await action(event);
            // Still busy on success: the screen is usually about to change.
            if (resetOnSuccess || result === false) {
                inFlight.current = false;
                setBusy(false);
            }
        } catch (error) {
            inFlight.current = false;
            setBusy(false);
            if (!onError) throw error;
            onError(error);
        }
    };

    return (
        <button
            ref={ref}
            type={type}
            onClick={handleClick}
            className={className ? `relative ${className}` : "relative"}
            {...rest}
        >
            {busyLabel ? (
                <>
                    <span className="action-spinner action-inline" aria-hidden />
                    <span className="action-swap">{children}</span>
                    <span className="action-busy-label">{busyLabel}</span>
                </>
            ) : (
                <>
                    {/* Wrapped so a bare string can fade; the wrapper inherits the button's layout. */}
                    <span className="action-label">{children}</span>
                    <span className="action-overlay" aria-hidden>
                        <span className="action-spinner" />
                    </span>
                </>
            )}
        </button>
    );
}
