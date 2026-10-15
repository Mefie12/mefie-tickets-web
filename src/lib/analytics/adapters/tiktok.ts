import { expireCookiesMatching, loadScript, whenIdle } from "@/lib/analytics/loader";
import type { AnalyticsAdapter, CommerceEvent } from "@/lib/analytics/types";

type Ttq = Array<unknown> & Record<string, unknown> & { methods?: string[]; _i?: Record<string, unknown>; _t?: Record<string, number>; _o?: Record<string, unknown> };
type TtqWindow = Window & { TiktokAnalyticsObject?: string; ttq?: Ttq };

const METHODS = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];

/**
 * TikTok Pixel (docs/26, Phase 2b-2): an ADVERTISING tool, so it belongs to the
 * Marketing consent choice, loads only when `NEXT_PUBLIC_TIKTOK_PIXEL_ID` is
 * set, and stays dormant until that choice is accepted.
 *
 * Same data minimisation as the Meta adapter: page views, InitiateCheckout and
 * CompletePayment with value and currency (and our order id as `event_id`),
 * nothing else. `grantConsent` / `revokeConsent` pause and resume sending.
 *
 * UNVERIFIED against TikTok's own documentation (only third-party sources
 * describe these consent methods and the loader shape): before enabling the
 * pixel, compare this loader with the base code shown in TikTok Events Manager
 * and confirm the consent methods behave as expected. Also turn automatic
 * advanced matching off in Events Manager (deployment checklist).
 */
export function createTikTokPixelAdapter(pixelId: string | undefined): AnalyticsAdapter {
  let resident = false;
  let sending = false;
  const w = () => window as unknown as TtqWindow;
  const call = (method: string, ...args: unknown[]) => {
    const fn = w().ttq?.[method];
    if (typeof fn === "function") (fn as (...a: unknown[]) => void)(...args);
  };

  return {
    id: "tiktok",
    group: "marketing",
    configured: () => Boolean(pixelId),
    resident: () => resident,
    start() {
      if (!pixelId || typeof window === "undefined") return;
      if (!resident) {
        resident = true;
        w().TiktokAnalyticsObject = "ttq";
        const ttq: Ttq = (w().ttq ?? []) as Ttq;
        w().ttq = ttq;
        ttq.methods = METHODS;
        // Calls made before the script arrives are queued and replayed by it.
        for (const method of METHODS) {
          ttq[method] = (...args: unknown[]) => {
            ttq.push([method, ...args]);
          };
        }
        const id = pixelId;
        ttq._i = ttq._i ?? {};
        ttq._i[id] = [];
        ttq._t = ttq._t ?? {};
        ttq._t[id] = Date.now();
        ttq._o = ttq._o ?? {};
        ttq._o[id] = {};
        whenIdle(() => loadScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(id)}&lib=ttq`));
      }
      call("grantConsent");
      sending = true;
    },
    stop() {
      if (!pixelId || !resident) return;
      sending = false;
      call("revokeConsent");
      expireCookiesMatching(/^_ttp$|^ttcsid|^ttclid$/);
    },
    pause() {
      if (!resident || !sending) return;
      sending = false;
      call("revokeConsent");
    },
    resume() {
      if (!resident || sending) return;
      sending = true;
      call("grantConsent");
    },
    pageView() {
      if (!resident || !sending) return;
      call("page");
    },
    track(event: CommerceEvent) {
      if (!resident || !sending) return false;
      if (event.type === "begin_checkout") {
        call("track", "InitiateCheckout", { value: event.value, currency: event.currency });
        return true;
      }
      if (event.type === "purchase") {
        call("track", "CompletePayment", { value: event.value, currency: event.currency }, { event_id: event.transactionId });
        return true;
      }
      return false; // view_item is not sent to advertising pixels
    },
  };
}
