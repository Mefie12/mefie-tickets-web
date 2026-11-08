export type TicketPerformanceRow = {
  row_type: "product" | "tier";
  product_id: number;
  price_tier_id: number | null;
  parent_product_id: number | null;
  name: string;
  capacity: number | null;
  is_unlimited: boolean;
  issued: number;
  remaining: number | null;
  revenue: string;
  currency: string;
};

export type BundlePerformanceRow = {
  bundle_id: number;
  title: string;
  tickets_per_bundle: number;
  bundles_sold: number;
  tickets_sold: number;
  cap: number | null;
  revenue_minor: number;
  currency: string;
};

export type EventOverview = {
  capacity: { capacity: number | null; is_unlimited: boolean };
  orders: { orders: number; gross_sales: string; currency: string };
  attendees: { confirmed: number; by_admission_source: { CHECKOUT: number; REGISTRATION: number } };
  checked_in: number;
  /** Active tickets on completed orders, including ones the buyer hasn't named yet. */
  tickets?: { sold: number; awaiting_names: number };
  ticket_performance: TicketPerformanceRow[];
  bundle_performance?: BundlePerformanceRow[];
  requires_attention?: { unanswered_required_attendee_questions: number };
};
