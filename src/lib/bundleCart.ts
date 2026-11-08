import type { PublicBundle, PublicProduct, PublicTicketOption } from "@/lib/publicEventApi";

/**
 * Bundles in the cart. A bundle line is stored and sent as
 * `{ bundle_id, quantity }`; the server expands it into ordinary tickets.
 * Here we only need to (a) key it in the selector, (b) turn the cart into
 * the API's discriminated line shape, (c) know which tickets it contains
 * for attendee slots, and (d) keep the steppers honest about stock shared
 * between bundles and directly-bought tickets.
 */

export const bundleLineKey = (bundleId: number) => `bundle:${bundleId}`;

/** Attendee line key for a ticket inside a bundle — matches the API's `line_key`. */
export const bundleAttendeeKey = (bundleId: number, productId: number, optionId: number | null) =>
  `b${bundleId}:${productId}:${optionId ?? "direct"}`;

/** A stored cart line: a ticket (product_id / option) or a bundle (bundle_id set, product_id 0). */
export type CartLine = { product_id: number; ticket_option_id: number | null; quantity: number; bundle_id?: number | null };

export type ApiCartItem =
  | { product_id: number; ticket_option_id?: number | null; quantity: number }
  | { type: "bundle"; bundle_id: number; quantity: number };

export const isBundleLine = (line: CartLine): line is CartLine & { bundle_id: number } =>
  typeof line.bundle_id === "number";

export function toApiItems(lines: CartLine[]): ApiCartItem[] {
  return lines.map((line) =>
    isBundleLine(line)
      ? { type: "bundle" as const, bundle_id: line.bundle_id, quantity: line.quantity }
      : { product_id: line.product_id, ticket_option_id: line.ticket_option_id, quantity: line.quantity },
  );
}

type Usage = { product: Map<number, number>; option: Map<number, number> };

/** Tickets the current selection takes from each product and option, optionally excluding one line. */
function usage(
  quantities: Record<string, number>,
  products: PublicProduct[],
  bundles: PublicBundle[],
  excludeKey: string | null,
): Usage {
  const out: Usage = { product: new Map(), option: new Map() };
  const add = (productId: number, optionId: number | null, n: number) => {
    out.product.set(productId, (out.product.get(productId) ?? 0) + n);
    if (optionId !== null) out.option.set(optionId, (out.option.get(optionId) ?? 0) + n);
  };
  for (const product of products) {
    const options = product.type === "TIERED" ? (product.options ?? []) : [null];
    for (const option of options) {
      const key = `${product.id}:${option?.id ?? "direct"}`;
      if (key === excludeKey) continue;
      add(product.id, option?.id ?? null, quantities[key] ?? 0);
    }
  }
  for (const bundle of bundles) {
    const key = bundleLineKey(bundle.id);
    if (key === excludeKey) continue;
    const qty = quantities[key] ?? 0;
    if (qty === 0) continue;
    for (const c of bundle.components) add(c.product_id, c.ticket_option_id, c.quantity * qty);
  }
  return out;
}

/** People still available for a ticket/option after the rest of the cart; null = unlimited or unknown. */
function remainingAfterCart(
  products: PublicProduct[],
  productId: number,
  optionId: number | null,
  used: Usage,
): number | null {
  const product = products.find((p) => p.id === productId);
  if (!product) return null; // bundle-only ticket: the server's `buyable` covers it
  const option: PublicTicketOption | null = optionId !== null ? (product.options ?? []).find((o) => o.id === optionId) ?? null : null;
  const limits: number[] = [];
  if (product.quantity_remaining !== null) limits.push(product.quantity_remaining - (used.product.get(productId) ?? 0));
  if (option) limits.push(option.quantity_remaining - (used.option.get(option.id) ?? 0));
  return limits.length === 0 ? null : Math.max(0, Math.min(...limits));
}

/** Max for a direct ticket line, taking bundles/other lines in the cart into account. */
export function maxTicketQuantityInCart(
  baseMax: number,
  quantities: Record<string, number>,
  products: PublicProduct[],
  bundles: PublicBundle[],
  productId: number,
  optionId: number | null,
): number {
  const key = `${productId}:${optionId ?? "direct"}`;
  const left = remainingAfterCart(products, productId, optionId, usage(quantities, products, bundles, key));
  return left === null ? baseMax : Math.min(baseMax, left);
}

/** Max bundles of this kind the buyer can select right now (10 when nothing else limits it). */
export function maxBundleQuantity(
  bundle: PublicBundle,
  quantities: Record<string, number>,
  products: PublicProduct[],
  bundles: PublicBundle[],
): number {
  const limits = [bundle.max_per_order ?? 10];
  if (bundle.buyable !== null) limits.push(bundle.buyable);
  const used = usage(quantities, products, bundles, bundleLineKey(bundle.id));
  for (const c of bundle.components) {
    const left = remainingAfterCart(products, c.product_id, c.ticket_option_id, used);
    if (left !== null) limits.push(Math.floor(left / c.quantity));
  }
  return Math.max(0, Math.min(...limits));
}

/** Is a bundle something a buyer could pick right now? */
export const isBundleAvailable = (bundle: PublicBundle) => bundle.is_on_sale && bundle.status === "AVAILABLE";

/** Attendee-slot lines for `quantity` of a bundle: one line per ticket type inside it. */
export function bundleSlotLines(bundle: PublicBundle | undefined, bundleId: number, quantity: number) {
  return (bundle?.components ?? []).map((c) => ({
    product_id: c.product_id,
    ticket_option_id: c.ticket_option_id,
    quantity: c.quantity * quantity,
    product_title: `${bundle?.title ?? "Bundle"} — ${c.label ?? "Ticket"}`,
    line_key: bundleAttendeeKey(bundleId, c.product_id, c.ticket_option_id),
  }));
}
