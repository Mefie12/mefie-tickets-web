import { TOKEN_ROUTE_SOURCES } from "@/lib/tokenRoutes";

/**
 * First path segments that are NOT public pages: authenticated areas, auth
 * flows and token-in-the-URL pages. Third-party analytics never runs there.
 * This mirrors the static route folders under src/app (and the "route" words
 * reserved in the API's ReservedShortCodes), minus the public `discover`.
 */
const NON_PUBLIC_FIRST_SEGMENTS = new Set([
  "admin", "dashboard", "events", "event-series", "organization", "organizers", "settings", "onboarding",
  "gate", "venue", "distributor", "tickets", "login", "register", "forgot-password", "reset-password",
  "verify-email", "invite", "invitations", "accept", "claim", "t", "api", "s", "link-unavailable",
]);

/** The path part of a TOKEN_ROUTE_SOURCES pattern (`/t/:path*` -> `/t`). */
const TOKEN_PREFIXES = TOKEN_ROUTE_SOURCES.map((source) => source.replace(/\/:path\*$/, ""));

/**
 * Whether third-party analytics may run on this path: the public site only
 * (home, discover, organization and event pages, checkout, confirmation).
 * Everything else — logged-in areas, login/registration, and every page whose
 * URL carries a secret token — is excluded.
 */
export function isTrackablePath(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const first = path.split("/")[1] ?? "";
  if (NON_PUBLIC_FIRST_SEGMENTS.has(first.toLowerCase())) return false;
  return !TOKEN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Query params we are willing to send to analytics: campaign tags and ad click ids only. */
const ANALYTICS_QUERY_ALLOWLIST = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ttclid", "msclkid"];

/**
 * The URL analytics sees for a page view: origin + path + only the allowlisted
 * query params. Order references, invitation codes or anything else in the
 * query string never leave the browser.
 */
export function analyticsLocation(href: string): string {
  const url = new URL(href);
  const kept = new URLSearchParams();
  for (const key of ANALYTICS_QUERY_ALLOWLIST) {
    const value = url.searchParams.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}
