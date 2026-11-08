import type { OrderSummaryLine } from "@/components/OrderSummaryCard";
import type { PublicBundle, PublicProduct } from "@/lib/publicEventApi";
import { toMinorUnits } from "@/lib/money";

export type CartLineForSummary = { product_id: number; ticket_option_id: number | null; product_title: string; quantity: number; bundle_id?: number | null };

/** Per-line price lookup: a tier's own price when set, else the product's flat current_price. */
export function summaryLinesFromCart(cartItems: CartLineForSummary[], products: PublicProduct[], currencyCode: string, bundles: PublicBundle[] = []): OrderSummaryLine[] {
  return cartItems.map((item) => {
    if (typeof item.bundle_id === "number") {
      const bundle = bundles.find((b) => b.id === item.bundle_id);
      return {
        label: bundle ? `${bundle.title} (${bundle.package_size} tickets)` : item.product_title,
        quantity: item.quantity,
        totalMinor: toMinorUnits(bundle?.price ?? 0, currencyCode) * item.quantity,
      };
    }
    const product = products.find((p) => p.id === item.product_id);
    const option = item.ticket_option_id ? product?.options?.find((o) => o.id === item.ticket_option_id) : null;
    const price = option ? option.price : (product?.current_price ?? 0);
    return {
      label: option?.name ?? product?.title ?? item.product_title,
      quantity: item.quantity,
      totalMinor: toMinorUnits(price, currencyCode) * item.quantity,
    };
  });
}
