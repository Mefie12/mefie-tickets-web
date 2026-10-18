import { loadScript, whenIdle } from "@/lib/analytics/loader";
import type { AnalyticsAdapter, CommerceEvent } from "@/lib/analytics/types";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] };
type ClarityWindow = Window & { clarity?: ClarityFn };

/**
 * Microsoft Clarity (docs/26, Phase 2b): heatmaps and session recordings,
 * loaded only after Product improvement consent and only on public pages.
 *
 * - Consent is passed with the v2 API (`consentv2`): analytics storage
 *   granted, ad storage denied. Without consent Clarity runs in a limited
 *   cookieless mode, so it is simply never loaded before consent.
 * - Clarity has no documented "stop" call, and even with consent denied it
 *   keeps a limited no-cookie session. Stop therefore calls `consent(false)`
 *   (erases its cookies, ends the session) and the manager follows it with a
 *   full page load, which removes the script entirely.
 * - Clarity tracks single-page navigation itself, so page views are a no-op.
 * - Input content, numbers and emails are masked by Clarity by default; the
 *   checkout pages also carry `data-clarity-mask="true"` (see CheckoutPage).
 * - Clarity says it must not be used on sites targeting under-18s, and from
 *   31 Oct 2025 requires a consent signal for EEA/UK/CH visitors (deployment
 *   checklist: set the project to require cookie consent).
 */
export function createClarityAdapter(projectId: string | undefined): AnalyticsAdapter {
  let resident = false;
  const w = () => window as unknown as ClarityWindow;

  return {
    id: "clarity",
    group: "product_improvement",
    configured: () => Boolean(projectId),
    resident: () => resident,
    start() {
      if (!projectId || typeof window === "undefined") return;
      if (!resident) {
        resident = true;
        w().clarity =
          w().clarity ??
          function clarity() {
            // eslint-disable-next-line prefer-rest-params
            ((w().clarity as ClarityFn).q = (w().clarity as ClarityFn).q ?? []).push(arguments);
          };
        whenIdle(() => loadScript(`https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`));
      }
      (w().clarity as ClarityFn)("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    },
    stop() {
      if (!projectId || typeof window === "undefined" || !resident) return;
      // Erases Clarity's cookies and ends the session until consent is granted again.
      w().clarity?.("consent", false);
    },
    pageView() {
      // Clarity follows client-side navigation on its own.
    },
    // Funnel markers only (no values, ids or names): they let recordings and
    // filters be sliced by "began checkout" / "purchased".
    track(event: CommerceEvent) {
      if (!projectId || typeof window === "undefined" || !resident || typeof w().clarity !== "function") return false;
      w().clarity?.("event", event.type);
      return true;
    },
  };
}
