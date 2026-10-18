/**
 * Privacy Choices & Cookie Consent — state model (version 2).
 *
 * Device/browser-scoped, not account-wide (spec §15): the choice lives in
 * this browser's `localStorage` (source of truth) mirrored to a small
 * first-party cookie so module-level code that runs before React — the
 * Sentry client init — can gate synchronously.
 *
 * Two independent OPTIONAL choices on top of always-on Necessary:
 *   - product_improvement: analytics and session recordings (PostHog,
 *     GA4, Clarity) and sampled performance tracing.
 *   - marketing: advertising pixels (Meta, TikTok). Only offered when a
 *     marketing tool is configured in this build (`marketing_offered`).
 * No valid current-version record means UNKNOWN: optional technologies stay
 * off until the visitor actively opts in.
 */
import { isMarketingConfigured } from "@/lib/analytics/config";

/**
 * Bumping this is the "renewed consent" mechanism (spec §10): a stored
 * record with a lower version is treated as UNKNOWN and the banner
 * reappears. Only bump on a material change to what optional data is
 * collected or why — not for wording tweaks. 1 -> 2: GA4 and Clarity widen
 * "Product improvement", and a separate Marketing choice exists.
 */
export const CONSENT_VERSION = 2;

/** The two optional choices. */
export type ConsentChoices = { productImprovement: boolean; marketing: boolean };

export type StoredConsent = {
  consent_version: number;
  necessary: true;
  product_improvement: boolean;
  marketing: boolean;
  /** Whether the Marketing choice was actually on offer when this was decided. */
  marketing_offered: boolean;
  decided_at: string;
};

export const NO_OPTIONAL_CONSENT: ConsentChoices = { productImprovement: false, marketing: false };

const STORAGE_KEY = "mefie-privacy-consent";
const COOKIE_NAME = "mefie_privacy_consent";
// ~6 months — the "configured retention period" the banner must not
// outlive without re-asking (spec §21.10).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 182;
const CONSENT_CHANGE_EVENT = "mefie:consent-change";

function cookieMarker(choices: ConsentChoices, marketingOffered: boolean): string {
  return `${CONSENT_VERSION}|pi=${choices.productImprovement ? 1 : 0}&mk=${choices.marketing ? 1 : 0}&of=${marketingOffered ? 1 : 0}`;
}

/**
 * Read the stored choice. Any problem — missing, unparseable, wrong shape,
 * or an older consent version — returns `null`, i.e. UNKNOWN. Privacy
 * controls fail toward the more private state (spec §18).
 */
export function readConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.consent_version !== CONSENT_VERSION ||
      typeof parsed.product_improvement !== "boolean" ||
      typeof parsed.marketing !== "boolean" ||
      typeof parsed.marketing_offered !== "boolean"
    ) {
      return null;
    }
    return {
      consent_version: CONSENT_VERSION,
      necessary: true,
      product_improvement: parsed.product_improvement,
      marketing: parsed.marketing,
      marketing_offered: parsed.marketing_offered,
      decided_at: typeof parsed.decided_at === "string" ? parsed.decided_at : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Whether the visitor still has to make a decision: nothing valid is stored,
 * or a Marketing tool is now configured but the stored choice was made
 * before it was on offer (the banner then shows once more).
 */
export function needsDecision(stored: StoredConsent | null, marketingConfigured: boolean = isMarketingConfigured()): boolean {
  if (!stored) return true;
  return marketingConfigured && !stored.marketing_offered;
}

/** The choices currently in force. Marketing is never on unless it was actually offered and accepted. */
export function currentChoices(stored: StoredConsent | null): ConsentChoices {
  if (!stored) return NO_OPTIONAL_CONSENT;
  return { productImprovement: stored.product_improvement, marketing: stored.marketing_offered && stored.marketing };
}

/**
 * Record a decision. Writes both `localStorage` and the mirror cookie, then
 * notifies listeners in this tab. `necessary` is always true. Marketing can
 * only be granted when a marketing tool is configured (otherwise it is
 * stored as false and flagged not-offered, so enabling a pixel later asks
 * for a fresh decision instead of reusing an old "Accept all").
 * Returns the stored record, or null where storage is not available.
 */
export function writeConsent(choices: ConsentChoices, marketingConfigured: boolean = isMarketingConfigured()): StoredConsent | null {
  if (typeof window === "undefined") return null;

  const record: StoredConsent = {
    consent_version: CONSENT_VERSION,
    necessary: true,
    product_improvement: choices.productImprovement,
    marketing: marketingConfigured && choices.marketing,
    marketing_offered: marketingConfigured,
    decided_at: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage unavailable (private mode, blocked) — the cookie below
    // still carries the choice for this browsing context.
  }

  try {
    document.cookie = `${COOKIE_NAME}=${cookieMarker({ productImprovement: record.product_improvement, marketing: record.marketing }, record.marketing_offered)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // ignore
  }

  emitConsentChange();
  return record;
}

/** True only when the visitor has actively accepted Product improvement. */
export function productImprovementAllowed(): boolean {
  return readConsent()?.product_improvement === true;
}

function readCookieMarker(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.split("; ").find((row) => row.startsWith(`${COOKIE_NAME}=`));
    return match ? match.slice(COOKIE_NAME.length + 1) : null;
  } catch {
    return null;
  }
}

/**
 * Parses `2|pi=1&mk=0&of=1`; anything else (other version, malformed) is null.
 * `&` not `;`: a semicolon would end the cookie value and the browser would
 * silently drop the rest of the marker.
 */
export function parseCookieMarker(marker: string | null): { productImprovement: boolean; marketing: boolean; marketingOffered: boolean } | null {
  const match = marker?.match(/^(\d+)\|pi=([01])&mk=([01])&of=([01])$/);
  if (!match || Number(match[1]) !== CONSENT_VERSION) return null;
  return { productImprovement: match[2] === "1", marketing: match[3] === "1" && match[4] === "1", marketingOffered: match[4] === "1" };
}

/**
 * Synchronous cookie read for code that runs before React hydrates
 * (Sentry's `instrumentation-client.ts`). Fails closed: anything other than
 * an explicit current-version `pi=1` marker is treated as not-consented. The
 * Marketing choice never affects this gate.
 */
export function readPrivacyConsentCookie(): boolean {
  return parseCookieMarker(readCookieMarker())?.productImprovement === true;
}

/** Synchronous cookie read of the Marketing choice; fails closed. */
export function readMarketingConsentCookie(): boolean {
  return parseCookieMarker(readCookieMarker())?.marketing === true;
}

/**
 * Subscribe to consent changes — both same-tab (a `writeConsent` call) and
 * cross-tab (the browser `storage` event). Returns an unsubscribe function.
 */
export function subscribeConsentChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) listener();
  };
  window.addEventListener(CONSENT_CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function emitConsentChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_CHANGE_EVENT));
}
