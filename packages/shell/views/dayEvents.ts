import {
    AlertTriangle,
    ArrowRightLeft,
    DollarSign,
    Hash,
    Image,
    Lock,
    LockOpen,
    LogOut,
    Package,
    ShoppingCart,
    Trash2,
    Wallet,
    type LucideIcon,
} from "lucide-react";

/** How each thing that happens in a day looks, wherever it is shown. */
export const EVENT: Record<string, { icon: LucideIcon; color: string }> = {
    order_created: { icon: ShoppingCart, color: "bg-blue-500" },
    store_opened: { icon: LockOpen, color: "bg-green-500" },
    store_closed: { icon: Lock, color: "bg-gray-500" },
    session_transferred: { icon: ArrowRightLeft, color: "bg-blue-500" },
    session_ended: { icon: LogOut, color: "bg-slate-400" },
    expense_created: { icon: DollarSign, color: "bg-orange-400" },
    expense_updated: { icon: DollarSign, color: "bg-orange-400" },
    expense_deleted: { icon: Trash2, color: "bg-red-400" },
    opening_balance_updated: { icon: Wallet, color: "bg-blue-400" },
    summary_photo_uploaded: { icon: Image, color: "bg-teal-400" },
    summary_photo_deleted: { icon: Trash2, color: "bg-red-400" },
    summary_photo_updated: { icon: Hash, color: "bg-teal-400" },
    supply_request_created: { icon: Package, color: "bg-purple-500" },
    incident_report_created: { icon: AlertTriangle, color: "bg-red-500" },
};
