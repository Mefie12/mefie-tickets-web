/**
 * Builds the `Cookie` header the web app forwards to Laravel (see `currentCookieHeader` in `backend.ts`).
 *
 * Next hands us DECODED cookie values, and `fetch` throws ("Cannot convert argument to a ByteString") for a
 * header value that contains a character above U+00FF, or a CR, LF or NUL. One such cookie used to crash every
 * server-rendered page that calls the API: the claim/accept/invite preview cookies carry organizer-typed text
 * (curly quotes, dashes, emoji, non-Latin names) that decodes to exactly those characters.
 *
 * So a pair is dropped only when it is one the API never reads or one `fetch` would reject anyway. Everything
 * else is forwarded exactly as before, in the same order and format. Values are never re-encoded: forwarding
 * decoded values is a contract with how `handleTokenEntry` re-sets Laravel's own cookies.
 */

/** Web-only render caches written by handleTokenEntry (`mefie_claim_preview`, …). Laravel never reads them. */
const WEB_ONLY_COOKIE = /^mefie_.+_preview$/;

/** What `fetch`/`Headers` rejects in a header value: anything above U+00FF, plus CR, LF and NUL. */
const UNSENDABLE = /[Ā-￿\r\n\0]/;

export function buildForwardCookieHeader(pairs: ReadonlyArray<{ name: string; value: string }>): string {
  const forwarded: string[] = [];

  for (const { name, value } of pairs) {
    if (WEB_ONLY_COOKIE.test(name)) continue;
    if (UNSENDABLE.test(name) || UNSENDABLE.test(value)) {
      // Name only — never the value, which can be a session credential.
      console.warn("[cookie-forward] dropped an unsendable cookie:", name.replace(UNSENDABLE, "?"));
      continue;
    }
    forwarded.push(`${name}=${value}`);
  }

  return forwarded.join("; ");
}
