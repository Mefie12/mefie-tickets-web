"use client";

import { useEffect } from "react";
import { trackViewItemWhenReady } from "@/lib/analytics/ecommerce";

/**
 * Sends a GA4 `view_item` when a public event (or series) page is viewed
 * (docs/26, Phase 2b-2). Renders nothing. The event page is a server
 * component, so this tiny client component carries the effect. It waits for
 * the tools to be started (a no-op for visitors who have not consented) and
 * sends once per page view; advertising pixels never receive it.
 */
export function EventViewTracker({ title, currency }: { title: string; currency: string }) {
  useEffect(() => trackViewItemWhenReady({ title, currency_code: currency }), [title, currency]);
  return null;
}
