import { expireCookiesMatching, loadScript, whenIdle } from "@/lib/analytics/loader";
import type { AnalyticsAdapter, CommerceEvent } from "@/lib/analytics/types";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
type FbqWindow = Window & { fbq?: Fbq; _fbq?: Fbq };

/**
 * Meta Pixel (docs/26, Phase 2b-2): an ADVERTISING tool, so it belongs to the
 * separate Marketing consent choice, loads only when `NEXT_PUBLIC_META_PIXEL_ID`
 * is set, and stays dormant until that choice is accepted.
 *
 * - Consent is passed with the documented pair: `fbq('consent','revoke')`
 *   BEFORE `init`, then `grant` because this only loads after the visitor
 *   accepted. Revoke later (stop, or the card-entry step) pauses sending;
 *   grant resumes it.
 * - Data minimisation: only PageView, InitiateCheckout and Purchase, with
 *   value and currency (and our order id as `eventID` for de-duplication).
 *   No event names, ticket names, emails or phone numbers; no advanced matching.
 * - Automatic configuration (the pixel reading buttons and form fields) is
 *   switched off with `fbq('set','autoConfig',false,ID)` before `init`. Meta's
 *   documentation page did not confirm that call, so ALSO turn off automatic
 *   advanced matching in Events Manager (deployment checklist), which is the
 *   authoritative control. Verify both when enabling the pixel.
 */
export function createMetaPixelAdapter(pixelId: string | undefined): AnalyticsAdapter {
  let resident = false;
  let sending = false;
  const w = () => window as unknown as FbqWindow;
  const fbq = (...args: unknown[]) => w().fbq?.(...args);

  return {
    id: "meta",
    group: "marketing",
    configured: () => Boolean(pixelId),
    resident: () => resident,
    start() {
      if (!pixelId || typeof window === "undefined") return;
      if (!resident) {
        resident = true;
        if (!w().fbq) {
          const stub = function fbqStub() {
            // eslint-disable-next-line prefer-rest-params
            const args = arguments;
            if (stub.callMethod) stub.callMethod.call(stub, ...(Array.from(args) as unknown[]));
            else (stub.queue as unknown[]).push(args);
          } as Fbq;
          stub.push = stub;
          stub.loaded = true;
          stub.version = "2.0";
          stub.queue = [];
          w().fbq = stub;
          w()._fbq = stub;
        }
        fbq("consent", "revoke"); // documented: before init
        fbq("set", "autoConfig", false, pixelId);
        fbq("init", pixelId);
        whenIdle(() => loadScript("https://connect.facebook.net/en_US/fbevents.js"));
      }
      fbq("consent", "grant");
      sending = true;
    },
    stop() {
      if (!pixelId || !resident) return;
      sending = false;
      fbq("consent", "revoke");
      expireCookiesMatching(/^_fbp$|^_fbc$/);
    },
    pause() {
      if (!resident || !sending) return;
      sending = false;
      fbq("consent", "revoke");
    },
    resume() {
      if (!resident || sending) return;
      sending = true;
      fbq("consent", "grant");
    },
    pageView() {
      if (!resident || !sending) return;
      fbq("track", "PageView");
    },
    track(event: CommerceEvent) {
      if (!resident || !sending) return false;
      if (event.type === "begin_checkout") {
        fbq("track", "InitiateCheckout", { value: event.value, currency: event.currency });
        return true;
      }
      if (event.type === "purchase") {
        fbq("track", "Purchase", { value: event.value, currency: event.currency }, { eventID: event.transactionId });
        return true;
      }
      return false; // view_item is not sent to advertising pixels
    },
  };
}
