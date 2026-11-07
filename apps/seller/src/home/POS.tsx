import { LoadFailed } from "@tea-pos/shell/LoadFailed";
import { useMe } from "@tea-pos/api-client/me";
import { formatMoney } from "@tea-pos/format";
import { useT } from "@tea-pos/i18n/react";
import { FooterSlot } from "@tea-pos/shell/FooterSlotContext";
import { Picture } from "@tea-pos/ui/Picture";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { toast } from "@tea-pos/ui/toast";
import { useState } from "react";

import { Cart, type CartItem } from "./Cart";
import { useCreateOrder, useGate, useProducts, type Product } from "./home";
import { HomeHeader } from "./HomeHeader";
import { StoreGate } from "./StoreGate";

/** The POS tab: the store's gate until it is the caller's, then the menu and the cart. */
export function POS() {
    const { data: gate, error } = useGate();
    const me = useMe().data;
    if (error && !gate) return <LoadFailed error={error} />;
    if (!gate)
        return (
            <div className="space-y-4">
                <HomeHeader />
                <Skeleton className="h-72 rounded-2xl" />
            </div>
        );
    const mine = gate.gate === "open" && gate.sellerId === me?.user.id;
    return (
        <div className="flex flex-col gap-4 min-h-full">
            <HomeHeader />
            {mine ? <Menu /> : <StoreGate gate={gate} />}
        </div>
    );
}

function Menu() {
    const t = useT();
    const { data } = useProducts();
    const createOrder = useCreateOrder();
    const [items, setItems] = useState<CartItem[]>([]);
    const [open, setOpen] = useState(false);
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const total = items.reduce((n, i) => n + i.product.price * i.quantity, 0);

    const add = (product: Product) =>
        setItems((cart) =>
            cart.some((i) => i.product.id === product.id)
                ? cart.map((i) =>
                      i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
                  )
                : [...cart, { product, quantity: 1 }],
        );
    const setQuantity = (id: string, quantity: number) =>
        setItems((cart) =>
            quantity <= 0
                ? cart.filter((i) => i.product.id !== id)
                : cart.map((i) => (i.product.id === id ? { ...i, quantity } : i)),
        );

    return (
        <>
            {items.length > 0 && (
                <FooterSlot>
                    <div className="bg-white border-y border-gray-400 p-4">
                        <div className="flex items-center justify-between max-w-md mx-auto">
                            <div className="flex-1">
                                <p className="text-sm text-gray-600">
                                    {count} {t("cart.items")}
                                </p>
                                <p className="text-lg font-bold text-gray-900">
                                    {formatMoney(total)}
                                </p>
                            </div>
                            <button
                                onClick={() => setOpen(true)}
                                className="px-3 py-2 bg-blue-500 text-white rounded-lg font-medium"
                            >
                                {t("cart.viewCart")}
                            </button>
                        </div>
                    </div>
                </FooterSlot>
            )}
            {!data ? (
                <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} delay={i * 40} className="h-28 rounded-2xl" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {data.products.map((p) => {
                        const quantity = items.find((i) => i.product.id === p.id)?.quantity ?? 0;
                        return (
                            <button
                                key={p.id}
                                onClick={() => add(p)}
                                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative text-left active:scale-[0.93] transition-transform duration-150"
                            >
                                {quantity > 0 && (
                                    <span className="absolute top-2 right-2 z-10 bg-red-500 text-white rounded-lg w-6 h-6 text-sm flex items-center justify-center font-medium">
                                        {quantity}
                                    </span>
                                )}
                                <span className="block p-3">
                                    <span className="flex gap-2 mb-3">
                                        {p.imageUrl && (
                                            <Picture
                                                src={p.imageUrl}
                                                className="size-[50px] rounded"
                                            />
                                        )}
                                        <span className="flex-1">
                                            <span className="block font-bold text-gray-800 text-base leading-tight mt-1">
                                                {p.name}
                                            </span>
                                            <span className="block text-base font-semibold text-green-600">
                                                {formatMoney(p.price)}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="block text-center text-brand text-sm font-medium py-1.5 rounded-lg border border-brand">
                                        {t("cart.tapToAdd")}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
            <Cart
                open={open}
                items={items}
                onClose={() => setOpen(false)}
                onClear={() => setItems([])}
                onQuantity={setQuantity}
                onConfirm={async () => {
                    await createOrder.mutateAsync({
                        items: items.map((i) => ({
                            productId: i.product.id,
                            quantity: i.quantity,
                            unitPrice: i.product.price,
                        })),
                    });
                    toast(
                        `${t("cart.orderConfirmed")} ${count} ${t("cart.items")} · ${formatMoney(total)}`,
                        { kind: "success" },
                    );
                    setItems([]);
                    setOpen(false);
                }}
            />
        </>
    );
}
