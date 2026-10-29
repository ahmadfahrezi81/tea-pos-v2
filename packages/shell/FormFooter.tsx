import { useT } from "@tea-pos/i18n/react";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { DOT_GRID } from "@tea-pos/ui/dot-grid";
import { Emoji, type EmojiName } from "@tea-pos/ui/Emoji";
import { Info } from "lucide-react";
import { useState } from "react";

import { FooterSlot } from "./FooterSlotContext";
import { Drawer } from "@tea-pos/ui/Drawer";

const TONE = {
    brand: "bg-brand",
    green: "bg-green-600",
    orange: "bg-orange-500",
    gray: "bg-gray-700",
} as const;

/**
 * A form's save button in the shell's footer, as the old apps. With `confirmTitle`, a tap opens
 * a sheet first (artwork, the title, what saving changes, the button, Cancel); the button spins
 * there while it saves, and the sheet closes only if the screen stays (a failure).
 */
export function FormFooter({
    label,
    busyLabel,
    onSubmit,
    disabled = false,
    tone = "brand",
    // The screens write through useApiMutation, which shows the error; the footer only lets go.
    onError = () => {},
    confirmTitle,
    confirmMessage,
    note,
    emoji = "floppyDisk",
}: {
    label: string;
    busyLabel?: string;
    /** The save; `false` sent nothing (a check failed) and releases the button. */
    onSubmit: () => void | boolean | Promise<unknown>;
    disabled?: boolean;
    tone?: keyof typeof TONE;
    onError?: (error: unknown) => void;
    confirmTitle?: string;
    confirmMessage?: string;
    /** The sheet's note; by default, that pay settings apply from now on, not to what is recorded. */
    note?: { title: string; body: string };
    emoji?: EmojiName;
}) {
    const t = useT();
    const [confirming, setConfirming] = useState(false);
    const shown = note ?? { title: t("shell.form.noteTitle"), body: t("shell.form.noteBody") };
    const button = `w-full ${TONE[tone]} text-white rounded-xl font-semibold text-base disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform`;
    return (
        <>
            <FooterSlot>
                <div className="bg-white border-t border-gray-200 p-4 pb-8">
                    <ActionButton
                        action={() => {
                            if (!confirmTitle) return onSubmit();
                            setConfirming(true);
                            // Opening the sheet sends nothing.
                            return false;
                        }}
                        onError={onError}
                        busyLabel={busyLabel ?? label}
                        disabled={disabled}
                        className={`${button} py-4`}
                    >
                        {label}
                    </ActionButton>
                </div>
            </FooterSlot>
            <ConfirmSheet
                open={confirming}
                title={confirmTitle ?? ""}
                message={confirmMessage}
                note={shown}
                emoji={emoji}
                label={label}
                busyLabel={busyLabel}
                tone={tone}
                onConfirm={async () => {
                    try {
                        const result = await onSubmit();
                        if (result === false) setConfirming(false);
                        return result;
                    } catch (error) {
                        setConfirming(false);
                        throw error;
                    }
                }}
                onError={onError}
                onCancel={() => setConfirming(false)}
            />
        </>
    );
}

/**
 * The old apps' confirm sheet: a pull tab, the artwork on a dot grid, the title and message,
 * one note, the button (it spins while it works) and Cancel.
 */
export function ConfirmSheet({
    open = true,
    title,
    message,
    note,
    emoji = "floppyDisk",
    label,
    busyLabel,
    tone = "brand",
    onConfirm,
    onError,
    onCancel,
}: {
    open?: boolean;
    title: string;
    message?: string;
    note?: { title: string; body: string };
    emoji?: EmojiName;
    label: string;
    busyLabel?: string;
    tone?: keyof typeof TONE;
    onConfirm: () => void | boolean | Promise<unknown>;
    onError?: (error: unknown) => void;
    onCancel: () => void;
}) {
    const t = useT();
    return (
        <Drawer
            open={open}
            onClose={onCancel}
            dim="bg-black/40"
            label={title}
            className="p-5 pb-8 space-y-4"
        >
            <div className="flex justify-center">
                <div className="w-8 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="relative -mx-5 flex justify-center py-3">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={DOT_GRID}
                />
                <Emoji name={emoji} size={88} className="relative" />
            </div>
            <div className="space-y-1 text-center">
                <p className="text-xl font-bold text-gray-900">{title}</p>
                {message && <p className="text-sm text-gray-600">{message}</p>}
            </div>
            {note && (
                <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-left">
                    <div className="size-9 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                        <Info size={18} className="text-blue-500" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-gray-900">{note.title}</p>
                        <p className="text-sm text-gray-500">{note.body}</p>
                    </div>
                </div>
            )}
            <ActionButton
                action={onConfirm}
                onError={onError}
                busyLabel={busyLabel ?? label}
                className={`w-full ${TONE[tone]} text-white rounded-xl text-base disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform py-3.5 font-bold`}
            >
                {label}
            </ActionButton>
            <button onClick={onCancel} className="w-full py-3 text-gray-500 text-sm font-medium">
                {t("common.cancel")}
            </button>
        </Drawer>
    );
}
