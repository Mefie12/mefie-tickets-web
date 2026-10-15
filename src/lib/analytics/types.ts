import type { ConsentChoices } from "@/lib/privacyConsent";

/** Which optional consent choice a tool falls under. */
export type AnalyticsGroup = "product_improvement" | "marketing";

/** A ticket line in a shopping event. Names are only ever sent to our own analytics (GA4), never to ad pixels. */
export type CommerceItem = { name: string; price?: number; quantity?: number };

/**
 * A shopping event (docs/26, Phase 2b-2), tool-neutral. Money is a number in
 * major units with an ISO 4217 currency; `transactionId` is our order id.
 */
export type CommerceEvent =
  | { type: "view_item"; currency: string; items: CommerceItem[] }
  | { type: "begin_checkout"; currency: string; value: number; items: CommerceItem[] }
  | { type: "purchase"; transactionId: string; currency: string; value: number; tax?: number; items: CommerceItem[] };

/**
 * One third-party tool. Adapters are tiny and vendor-specific; WHEN they run
 * (consent, public pages only, reload on exit) is decided once in manager.ts.
 */
export interface AnalyticsAdapter {
  id: string;
  group: AnalyticsGroup;
  /** An id is set for this tool in this build; an unconfigured tool never loads. */
  configured(): boolean;
  /** The vendor script is on the page (it cannot be unloaded without a page load). */
  resident(): boolean;
  /** Start / resume collection. Injects the script the first time. */
  start(): void;
  /** Stop collection as far as the vendor allows. Does not remove a resident script. */
  stop(): void;
  /** Report a page view for the current location (called on first start and on every client-side navigation). */
  pageView(href: string): void;
  /** Report a shopping event. Returns true only if it was actually sent (a paused or unsupported event returns false). */
  track?(event: CommerceEvent): boolean;
  /** Temporarily hold collection without unloading (the card-entry step). Only meaningful while started. */
  pause?(): void;
  resume?(): void;
}

export function groupAllowed(group: AnalyticsGroup, choices: ConsentChoices): boolean {
  return group === "marketing" ? choices.marketing : choices.productImprovement;
}
