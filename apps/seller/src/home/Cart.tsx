import { formatMoney } from "@tea-pos/format";
import { useT } from "@tea-pos/i18n/react";
import { ActionButton } from "@tea-pos/ui/ActionButton";
import { Drawer } from "@tea-pos/ui/Drawer";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";

import type { Product } from "./home";

export type CartItem = { product: Product; quantity: number };

export function Cart({
    open,
    items,
    onClose,
    onClear,
    onQuantity,
    onConfirm,
}: {
    open: boolean;
    items: CartItem[];
    onClose: () => void;
    onClear: () => void;
    onQuantity: (id: string, quantity: number) => void;
    onConfirm: () => Promise<unknown>;
}) {
    const t = useT();
    const total = items.reduce((n, i) => n + i.product.price * i.quantity, 0);
    return (
        <Drawer open={open} onClose={onClose} label={t("cart.title")}>
            <div className="max-h-[90vh] flex flex-col">
                <div className="shrink-0 px-4 py-4 flex items-center gap-2">
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-gray-900 -ml-2"
                        aria-label={t("common.close")}
                    >
                        <X size={24} />
                    </button>
                    <p className="text-xl font-bold text-gray-900">{t("cart.title")}</p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-4">
                    <h4 className="text-xl font-bold text-gray-800 mb-4 flex items-baseline gap-1">
                        {t("cart.currentOrder")}
                        {items.length > 0 && (
                            <button onClick={onClear} className="text-red-500 px-2 text-sm">
                                {t("cart.clearAll")}
                            </button>
                        )}
                    </h4>
                    {items.length === 0 ? (
                        <div className="text-center text-gray-500 my-20">
                            <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p>{t("cart.noItems")}</p>
                        </div>
                    ) : (
                        <div className="space-y-4 pb-4">
                            {items.map(({ product: p, quantity }) => (
                                <div
                                    key={p.id}
                                    className="border-b border-gray-100 pb-4 last:border-b-0"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1">
                                            <h5 className="font-medium text-lg text-gray-900">
                                                {p.name}
                                            </h5>
                                            <p className="text-sm text-gray-600">
                                                {quantity} x {formatMoney(p.price)} / Pcs
                                            </p>
                                        </div>
                                        <p className="text-lg font-bold text-gray-900">
                                            {formatMoney(p.price * quantity)}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <button
                                            onClick={() => onQuantity(p.id, 0)}
                                            className="w-8 h-8 text-red-500 rounded-lg flex items-center justify-center border border-red-300 active:scale-95 transition-transform"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => onQuantity(p.id, quantity - 1)}
                                                className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                                            >
                                                <Minus size={18} />
                                            </button>
                                            <span className="font-semibold text-lg w-8 text-center">
                                                {quantity}
                                            </span>
                                            <button
                                                onClick={() => onQuantity(p.id, quantity + 1)}
                                                className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center active:scale-95 transition-transform"
                                            >
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="shrink-0 bg-white px-4 pt-4 pb-4 border-t border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xl font-bold text-gray-900">
                            {t("cart.totalTransaction")}
                        </span>
                        <span className="text-xl font-bold text-gray-900">
                            {formatMoney(total)}
                        </span>
                    </div>
                    <ActionButton
                        action={onConfirm}
                        onError={() => {}}
                        resetOnSuccess
                        disabled={items.length === 0}
                        className="w-full bg-green-500 text-white py-4 rounded-xl text-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {t("cart.confirmOrder")}
                    </ActionButton>
                </div>
            </div>
        </Drawer>
    );
}
