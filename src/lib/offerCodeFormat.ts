/**
 * Immediate, deterministic feedback on a typed promo code. This mirrors the
 * server's OfferCode::normalize()/isValidFormat() (`^[A-Z0-9_-]{4,32}$`) but
 * is only UX: the server re-normalizes and re-validates, and is the only
 * authority on whether a code exists, is active, applies, or has capacity.
 * Server rejections stay generic on purpose (code enumeration protection);
 * only this format check is specific, because it depends solely on the input.
 */
export const PROMO_CODE_MIN = 4;
export const PROMO_CODE_MAX = 32;

/** trim + uppercase. Validate and submit THIS value, never the raw input. */
export function normalizePromoCode(input: string): string {
  return input.trim().toUpperCase();
}

/** Null when valid. Empty is not an error — callers treat it as "remove the code". */
export function promoCodeFormatError(normalized: string): string | null {
  if (normalized === "") return null;
  if (!/^[A-Z0-9_-]*$/.test(normalized)) return "Promo codes only use letters, numbers, hyphens and underscores.";
  if (normalized.length < PROMO_CODE_MIN) return `Promo codes are at least ${PROMO_CODE_MIN} characters.`;
  if (normalized.length > PROMO_CODE_MAX) return `Promo codes are at most ${PROMO_CODE_MAX} characters.`;
  return null;
}

/**
 * "Notify once per attempt": a rejection notification fires on the
 * transition Apply → server rejects, never on re-renders or repeat quotes of
 * the same attempt. Attempt 0 (a code that arrived from a link or storage,
 * not typed) never notifies; the inline alert covers it.
 */
export function createRejectionNotifier() {
  let lastNotified = 0;
  return function shouldNotify(attempt: number, rejected: boolean, settled: boolean): boolean {
    if (attempt <= 0 || !rejected || !settled || attempt <= lastNotified) return false;
    lastNotified = attempt;
    return true;
  };
}
