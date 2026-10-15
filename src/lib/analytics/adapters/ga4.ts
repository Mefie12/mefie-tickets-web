import { analyticsLocation } from "@/lib/analytics/paths";
import { expireCookiesMatching, loadScript, whenIdle } from "@/lib/analytics/loader";
import type { AnalyticsAdapter, CommerceEvent } from "@/lib/analytics/types";

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } & Record<string, unknown>;

/**
 * Google Analytics 4 (docs/26, Phase 2b), loaded only after Product
 * improvement consent and only on public pages (see manager.ts).
 *
 * - Consent mode v2 default is set BEFORE `config`, as Google requires: the
 *   advertising signals are denied; analytics storage is granted because this
 *   only runs after the visitor accepted.
 * - Automatic page views are off: the manager sends one per navigation with a
 *   scrubbed location (utm_* and click ids only), so order references or other
 *   query params never leave the browser. Disable "Page changes based on
 *   browser history events" and "Site search" in GA4 enhanced measurement, or
 *   GA4 will also send its own, unscrubbed page views (deployment checklist).
 * - Stop = the documented `window['ga-disable-<ID>']` flag (checked on every
 *   send) plus removing GA's cookies.
 */
export function createGa4Adapter(measurementId: string | undefined): AnalyticsAdapter {
  let resident = false;
  const w = () => window as unknown as GtagWindow;
  const disableKey = `ga-disable-${measurementId}`;

  return {
    id: "ga4",
    group: "product_improvement",
    configured: () => Boolean(measurementId),
    resident: () => resident,
    start() {
      if (!measurementId || typeof window === "undefined") return;
      w()[disableKey] = false;
      if (resident) return;
      resident = true;
      w().dataLayer = w().dataLayer ?? [];
      w().gtag = function gtag() {
        // eslint-disable-next-line prefer-rest-params
        (w().dataLayer as unknown[]).push(arguments);
      };
      const gtag = w().gtag as (...args: unknown[]) => void;
      gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
      gtag("js", new Date());
      gtag("config", measurementId, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
      whenIdle(() => loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`));
    },
    stop() {
      if (!measurementId || typeof window === "undefined") return;
      w()[disableKey] = true;
      expireCookiesMatching(/^_ga(_.*)?$|^_gid$|^_gat/);
    },
    pageView(href) {
      if (!measurementId || typeof window === "undefined" || !resident || w()[disableKey] === true) return;
      const gtag = w().gtag;
      if (typeof gtag !== "function") return;
      const location = analyticsLocation(href);
      gtag("event", "page_view", { page_location: location, page_path: new URL(location).pathname, page_title: document.title });
    },
    // Shopping events (docs/26, Phase 2b-2): GA4's own e-commerce events, so its
    // reports show tickets sold and revenue per acquisition channel.
    track(event: CommerceEvent) {
      if (!measurementId || typeof window === "undefined" || !resident || w()[disableKey] === true) return false;
      const gtag = w().gtag;
      if (typeof gtag !== "function") return false;
      const items = event.items.map((item) => ({ item_name: item.name, ...(item.price !== undefined ? { price: item.price } : {}), ...(item.quantity !== undefined ? { quantity: item.quantity } : {}) }));
      if (event.type === "view_item") {
        gtag("event", "view_item", { currency: event.currency, items });
      } else if (event.type === "begin_checkout") {
        gtag("event", "begin_checkout", { currency: event.currency, value: event.value, items });
      } else {
        gtag("event", "purchase", { transaction_id: event.transactionId, currency: event.currency, value: event.value, ...(event.tax !== undefined ? { tax: event.tax } : {}), items });
      }
      return true;
    },
  };
}
