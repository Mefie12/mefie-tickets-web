import { ApiError } from "@/lib/authApi";

/** MVP only ever creates TICKET products via this API — see CreateProductData. */
// FREE stays in the union only to type-check existing/legacy products
// still readable from the API — it's no longer a creatable value (see
// ProductsEditor.tsx's PRICING_OPTIONS). REGISTRATION is the $0-ticket
// option organizers pick now: every free ticket requires registration.
export type PricingType = "FREE" | "PAID" | "TIERED" | "REGISTRATION";

export type TicketOption = {
  id: number;
  product_id: number;
  name: string;
  description: string | null;
  bundle_only: boolean;
  sort_order: number;
  price: string;
  starts_at: string | null;
  ends_at: string | null;
  quantity_available: number;
  quantity_sold: number;
  quantity_reserved: number;
  quantity_complimentary_held: number;
  disabled_at: string | null;
  is_enabled: boolean;
  max_attendees_per_registration: number | null;
};

export type Product = {
  id: number;
  organization_id: string;
  event_id: number;
  title: string;
  description: string | null;
  bundle_only: boolean;
  product_type: "TICKET" | "GENERAL";
  type: PricingType;
  price: string | null;
  quantity_available: number | null;
  quantity_sold: number;
  quantity_reserved: number;
  quantity_complimentary_held: number;
  starts_at: string | null;
  ends_at: string | null;
  disabled_at: string | null;
  max_attendees_per_registration: number | null;
  current_price: string | null;
  is_sold_out: boolean;
  is_on_sale: boolean;
  quantity_remaining: number | null;
  price_tiers: TicketOption[];
};

/**
 * Matches App\Domain\Products\DataObjects\TierInputData. `id: null` (or
 * omitted) creates a new tier.
 *
 * Note the asymmetry with `ProductTier` above, and it's deliberate: the
 * response carries UTC *instants* (`starts_at`/`ends_at`), the request
 * carries *wall-clock parts*, resolved server-side against the parent
 * event's timezone. Both halves of a pair must be sent, or neither.
 */
export type TicketOptionInput = {
  id?: number | null;
  name: string;
  description?: string | null;
  bundle_only?: boolean | null;
  sort_order: number;
  price: number;
  starts_at_date?: string | null;
  starts_at_time?: string | null;
  ends_at_date?: string | null;
  ends_at_time?: string | null;
  quantity_available: number;
  is_enabled: boolean;
  max_attendees_per_registration?: number | null;
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
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

export function listProducts(eventId: number) {
  return request<{ products: Product[]; bundles_enabled?: boolean }>(`/api/events/${eventId}/products`);
}

/**
 * Sale-window fields follow the same wall-clock-parts pattern as
 * TierInput's — both a date and a time, or neither, per side.
 */
export type ProductWindowInput = {
  starts_at_date?: string | null;
  starts_at_time?: string | null;
  ends_at_date?: string | null;
  ends_at_time?: string | null;
  is_enabled?: boolean;
};

export function createProduct(
  eventId: number,
  input: {
    title: string;
    description?: string | null;
    bundle_only?: boolean;
    type: PricingType;
    price?: number | null;
    quantity_available?: number | null;
    max_attendees_per_registration?: number | null;
    tiers?: TicketOptionInput[];
  } & ProductWindowInput,
) {
  return request<{ product: Product }>(`/api/events/${eventId}/products`, { method: "POST", body: input });
}

export function updateProduct(
  eventId: number,
  productId: number,
  input: {
    title?: string;
    description?: string | null;
    bundle_only?: boolean;
    type?: PricingType;
    price?: number | null;
    quantity_available?: number | null;
    max_attendees_per_registration?: number | null;
    tiers?: TicketOptionInput[];
  } & ProductWindowInput,
) {
  return request<{ product: Product }>(`/api/events/${eventId}/products/${productId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteProduct(eventId: number, productId: number) {
  return request<void>(`/api/events/${eventId}/products/${productId}`, { method: "DELETE" });
}

// --- bundles -----------------------------------------------------------

/** One ticket (or ticket option) inside a bundle, × count. */
export type BundleComponent = {
  product_id: number;
  ticket_option_id: number | null;
  quantity: number;
  label?: string;
  list_price?: string;
};

/** Organizer view of a bundle (BundleResource). */
export type Bundle = {
  id: number;
  title: string;
  description: string | null;
  price: string;
  quantity_available: number | null;
  quantity_sold: number;
  quantity_reserved: number;
  max_per_order: number | null;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_enabled: boolean;
  /** Price and components are frozen once anything has sold. */
  is_locked: boolean;
  package_size: number;
  list_total: string;
  /** null = unlimited. */
  buyable: number | null;
  components: BundleComponent[];
};

export type BundleInput = {
  title?: string;
  description?: string | null;
  price?: number;
  components?: { product_id: number; ticket_option_id?: number | null; quantity: number }[];
  quantity_available?: number | null;
  max_per_order?: number | null;
  is_enabled?: boolean;
} & Omit<ProductWindowInput, "is_enabled">;

export function listBundles(eventId: number) {
  return request<{ bundles: Bundle[] }>(`/api/events/${eventId}/bundles`);
}

export function createBundle(eventId: number, input: BundleInput) {
  return request<{ bundle: Bundle; warnings: string[] }>(`/api/events/${eventId}/bundles`, { method: "POST", body: input });
}

export function updateBundle(eventId: number, bundleId: number, input: BundleInput) {
  return request<{ bundle: Bundle; warnings: string[] }>(`/api/events/${eventId}/bundles/${bundleId}`, { method: "PATCH", body: input });
}

export function deleteBundle(eventId: number, bundleId: number) {
  return request<void>(`/api/events/${eventId}/bundles/${bundleId}`, { method: "DELETE" });
}
