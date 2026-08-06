import { ApiError } from "@/lib/authApi";

/** MVP only ever creates TICKET products via this API — see CreateProductData. */
export type PricingType = "FREE" | "PAID" | "TIERED";

export type ProductTier = {
  id: number;
  product_id: number;
  name: string;
  sort_order: number;
  price: string;
  starts_at: string | null;
  ends_at: string | null;
  quantity_threshold: number | null;
  quantity_sold: number;
  disabled_at: string | null;
  is_enabled: boolean;
};

export type Product = {
  id: number;
  account_id: number;
  organizer_id: number;
  event_id: number;
  title: string;
  product_type: "TICKET" | "GENERAL";
  type: PricingType;
  price: string | null;
  quantity_available: number | null;
  sales_volume: number;
  current_price: string | null;
  is_sold_out: boolean;
  active_tier_id: number | null;
  quantity_remaining: number | null;
  price_tiers: ProductTier[];
};

/** Matches App\Domain\Products\DataObjects\TierInputData. `id: null` (or omitted) creates a new tier. */
export type TierInput = {
  id?: number | null;
  name: string;
  sort_order: number;
  price: number;
  starts_at?: string | null;
  ends_at?: string | null;
  quantity_threshold?: number | null;
  is_enabled: boolean;
};

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors);
  }

  return data as T;
}

export function listProducts(eventId: number) {
  return request<{ products: Product[] }>(`/api/events/${eventId}/products`);
}

export function createProduct(
  eventId: number,
  input: { title: string; type: PricingType; price?: number | null; quantity_available?: number | null; tiers?: TierInput[] },
) {
  return request<{ product: Product }>(`/api/events/${eventId}/products`, { method: "POST", body: input });
}

export function updateProduct(
  eventId: number,
  productId: number,
  input: {
    title?: string;
    type?: PricingType;
    price?: number | null;
    quantity_available?: number | null;
    tiers?: TierInput[];
  },
) {
  return request<{ product: Product }>(`/api/events/${eventId}/products/${productId}`, {
    method: "PATCH",
    body: input,
  });
}
