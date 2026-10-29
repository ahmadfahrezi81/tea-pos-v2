import { AlertTriangle, Info, X } from "lucide-react";

import { Dialog } from "./Drawer";

/** The old backoffice's "are you sure": a centred card over a dark page; a tap outside cancels. */
export function ConfirmDialog({
    open,
    title,
    message,
    detailsLabel,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    type = "info",
}: {
    open: boolean;
    title: string;
    message: string;
    /** The small heading above the message ("Details:"). */
    detailsLabel?: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: "warning" | "info";
}) {
    const warning = type === "warning";
    const Icon = warning ? AlertTriangle : Info;
    return (
        <Dialog
            open={open}
            onClose={onCancel}
            label={title}
            className="w-full max-w-sm rounded-xl bg-white p-4"
        >
            <div className="mb-4 flex items-center justify-between">
                <div className="flex flex-1 items-center">
                    <Icon
                        size={20}
                        className={`mr-2 shrink-0 ${warning ? "text-orange-500" : "text-blue-500"}`}
                    />
                    <h3 className="text-lg font-semibold">{title}</h3>
                </div>
                <button
                    onClick={onCancel}
                    className="ml-2 shrink-0 rounded p-1 hover:bg-gray-100"
                    aria-label={cancelText}
                >
                    <X size={20} />
                </button>
            </div>
            {detailsLabel && (
                <h4 className="mb-1 text-sm font-semibold text-gray-800">{detailsLabel}</h4>
            )}
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-2">
                <p className="text-gray-800">{message}</p>
            </div>
            <div className="flex justify-end gap-3">
                <button
                    onClick={onCancel}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                    {cancelText}
                </button>
                <button
                    onClick={onConfirm}
                    className={`rounded-lg px-4 py-2 font-medium text-white ${
                        warning
                            ? "bg-orange-500 hover:bg-orange-600"
                            : "bg-blue-500 hover:bg-blue-600"
                    }`}
                >
                    {confirmText}
                </button>
            </div>
        </Dialog>
    );
}
