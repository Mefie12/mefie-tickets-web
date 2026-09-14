/**
 * Privacy Choices & Cookie Consent — V1 state model.
 *
 * Device/browser-scoped, not account-wide (spec §15): the choice lives in
 * this browser's `localStorage` (source of truth) mirrored to a small
 * first-party cookie so module-level code that runs before React — the
 * Sentry client init — can gate synchronously.
 *
 * Three meaningful states (spec §11): UNKNOWN (no valid choice yet),
 * NECESSARY_ONLY, ALL_ACCEPTED. UNKNOWN is never treated as ALL_ACCEPTED —
 * optional technologies stay off until the visitor actively opts in.
 */

/**
 * Bumping this is the "renewed consent" mechanism (spec §10): a stored
 * record with a lower version is treated as UNKNOWN and the banner
 * reappears. Only bump on a material change to what optional data is
 * collected or why — not for wording tweaks.
 */
export const CONSENT_VERSION = 1;

export type ConsentState = "UNKNOWN" | "NECESSARY_ONLY" | "ALL_ACCEPTED";

export type StoredConsent = {
  consent_version: number;
  necessary: true;
  product_improvement: boolean;
  decided_at: string;
};

const STORAGE_KEY = "mefie-privacy-consent";
const COOKIE_NAME = "mefie_privacy_consent";
// ~6 months — the "configured retention period" the banner must not
// outlive without re-asking (spec §21.10).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 182;
const CONSENT_CHANGE_EVENT = "mefie:consent-change";

function cookieMarker(productImprovement: boolean): string {
  return `${CONSENT_VERSION}|${productImprovement ? "all" : "necessary"}`;
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
      typeof parsed.product_improvement !== "boolean"
    ) {
      return null;
    }
    return {
      consent_version: CONSENT_VERSION,
      necessary: true,
      product_improvement: parsed.product_improvement,
      decided_at: typeof parsed.decided_at === "string" ? parsed.decided_at : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Record a decision. Writes both `localStorage` and the mirror cookie, then
 * notifies listeners in this tab. `necessary` is always true; the only
 * variable is whether Product improvement is permitted.
 */
export function writeConsent(productImprovement: boolean): void {
  if (typeof window === "undefined") return;

  const record: StoredConsent = {
    consent_version: CONSENT_VERSION,
    necessary: true,
    product_improvement: productImprovement,
    decided_at: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage unavailable (private mode, blocked) — the cookie below
    // still carries the choice for this browsing context.
  }

  try {
    document.cookie = `${COOKIE_NAME}=${cookieMarker(productImprovement)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // ignore
  }

  emitConsentChange();
}

export function consentState(stored: StoredConsent | null): ConsentState {
  if (!stored) return "UNKNOWN";
  return stored.product_improvement ? "ALL_ACCEPTED" : "NECESSARY_ONLY";
}

/** True only when the visitor has actively accepted Product improvement. */
export function productImprovementAllowed(): boolean {
  return readConsent()?.product_improvement === true;
}

/**
 * Synchronous cookie read for code that runs before React hydrates
 * (Sentry's `instrumentation-client.ts`). Fails closed: anything other than
 * an explicit current-version "all" marker is treated as not-consented.
 */
export function readPrivacyConsentCookie(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const match = document.cookie.split("; ").find((row) => row.startsWith(`${COOKIE_NAME}=`));
    return match?.slice(COOKIE_NAME.length + 1) === `${CONSENT_VERSION}|all`;
  } catch {
    return false;
  }
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
