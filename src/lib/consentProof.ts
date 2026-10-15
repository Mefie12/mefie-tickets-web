/**
 * Best-effort proof of the visitor's privacy choices (docs/26, Phase 2b):
 * after every decision the browser sends the choice, the consent version and
 * a random anonymous id to the API, so we can later show who consented to
 * what and when WITHOUT identifying anyone (no IP, user agent or account is
 * stored). The anonymous id only ties one browser's successive choices
 * together; it lives in this browser's localStorage next to the choice itself.
 * Failures are swallowed: recording proof must never block or break the banner.
 */
import type { StoredConsent } from "@/lib/privacyConsent";

const ID_KEY = "mefie-consent-id";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Non-secure contexts have no randomUUID; build a v4 UUID from getRandomValues.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function anonymousConsentId(): string {
  try {
    const existing = window.localStorage.getItem(ID_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const created = newId();
    window.localStorage.setItem(ID_KEY, created);
    return created;
  } catch {
    return newId();
  }
}

export function recordConsentProof(record: StoredConsent): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/public/privacy-consents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        anonymous_id: anonymousConsentId(),
        consent_version: record.consent_version,
        product_improvement: record.product_improvement,
        marketing: record.marketing,
        marketing_offered: record.marketing_offered,
      }),
    }).catch(() => {});
  } catch {
    // ignore
  }
}
