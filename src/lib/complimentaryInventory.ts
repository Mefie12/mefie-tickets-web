import type { ComplimentaryPoolLine } from "@/lib/complimentaryApi";
import type { Product, TicketOption } from "@/lib/productApi";

export type ComplimentaryInventoryItem = {
  key: string;
  product: Product;
  option: TicketOption | null;
  productId: number;
  optionId: number | null;
  label: string;
};

export function complimentaryKey(productId: number, optionId: number | null) {
  return `${productId}:${optionId ?? "none"}`;
}

export function complimentaryInventory(products: Product[]): ComplimentaryInventoryItem[] {
  return products.flatMap<ComplimentaryInventoryItem>((product) => product.type === "TIERED"
    ? product.price_tiers.map((option) => ({ key: complimentaryKey(product.id, option.id), product, option, productId: product.id, optionId: option.id, label: `${product.title} — ${option.name}` }))
    : [{ key: complimentaryKey(product.id, null), product, option: null, productId: product.id, optionId: null, label: product.title }]);
}

export function poolLineKey(line: Pick<ComplimentaryPoolLine, "product_id" | "product_price_tier_id">) {
  return complimentaryKey(line.product_id, line.product_price_tier_id);
}

export function optionRemaining(option: TicketOption) {
  return Math.max(
    0,
    Number(option.quantity_available ?? 0)
      - Number(option.quantity_sold ?? 0)
      - Number(option.quantity_reserved ?? 0)
      - Number(option.quantity_complimentary_held ?? 0),
  );
}
