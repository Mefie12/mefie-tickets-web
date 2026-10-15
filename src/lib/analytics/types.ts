import type { ConsentChoices } from "@/lib/privacyConsent";

/** Which optional consent choice a tool falls under. */
export type AnalyticsGroup = "product_improvement" | "marketing";

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
}

export function groupAllowed(group: AnalyticsGroup, choices: ConsentChoices): boolean {
  return group === "marketing" ? choices.marketing : choices.productImprovement;
}
