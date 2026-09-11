import type { OrderSummaryLine } from "@/components/OrderSummaryCard";
import type { PublicProduct } from "@/lib/publicEventApi";

export type CartLineForSummary = { product_id: number; ticket_option_id: number | null; product_title: string; quantity: number };

/** Per-line price lookup: a tier's own price when set, else the product's flat current_price. */
export function summaryLinesFromCart(cartItems: CartLineForSummary[], products: PublicProduct[]): OrderSummaryLine[] {
  return cartItems.map((item) => {
    const product = products.find((p) => p.id === item.product_id);
    const option = item.ticket_option_id ? product?.options?.find((o) => o.id === item.ticket_option_id) : null;
    const price = option ? option.price : (product?.current_price ?? 0);
    return {
      label: option?.name ?? product?.title ?? item.product_title,
      quantity: item.quantity,
      totalMinor: Math.round(Number(price) * 100) * item.quantity,
    };
  });
}
