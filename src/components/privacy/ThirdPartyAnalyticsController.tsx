"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";
import { createAdapters, planAnalytics } from "@/lib/analytics/manager";

/**
 * Bridges consent + the current route to the third-party analytics tools
 * (GA4, Clarity; docs/26 Phase 2b). All the decisions live in the pure
 * `planAnalytics`; this only applies them:
 *  - starts a tool once its consent group is accepted on a public page,
 *    sending the first page view, then one page view per client-side navigation;
 *  - stops a tool when consent is withdrawn;
 *  - does a full page load when a tool's script is still resident on a page it
 *    must not run on (logged-in areas, login, token pages) or after consent
 *    was withdrawn, because a vendor script cannot be unloaded any other way.
 * PostHog is handled separately by ProductImprovementController.
 */
export function ThirdPartyAnalyticsController() {
  const { choices, ready } = usePrivacyConsent();
  const pathname = usePathname();
  const adapters = useMemo(() => createAdapters(), []);
  const active = useRef(new Set<string>());
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    const pathChanged = lastPath.current !== null && lastPath.current !== pathname;
    lastPath.current = pathname;

    const plan = planAnalytics({
      pathname,
      choices,
      pathChanged,
      adapters: adapters.map((a) => ({ id: a.id, group: a.group, configured: a.configured(), resident: a.resident(), active: active.current.has(a.id) })),
    });
    const byId = (id: string) => adapters.find((a) => a.id === id);

    for (const id of plan.stop) {
      byId(id)?.stop();
      active.current.delete(id);
    }
    if (plan.reload) {
      window.location.reload();
      return;
    }
    for (const id of plan.start) {
      const adapter = byId(id);
      if (!adapter) continue;
      adapter.start();
      active.current.add(id);
      adapter.pageView(window.location.href);
    }
    if (pathChanged) {
      for (const id of active.current) {
        if (!plan.start.includes(id)) byId(id)?.pageView(window.location.href);
      }
    }
  }, [ready, choices, pathname, adapters]);

  return null;
}
