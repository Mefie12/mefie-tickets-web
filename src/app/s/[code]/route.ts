import { NextRequest, NextResponse } from "next/server";
import { APP_URL, backendRequest } from "@/lib/backend";
import { buildShortLinkDestination, canonicalEventUrl, fallbackPath } from "@/lib/shortLink";

// Every visit must reach the API (it counts the click) and an edited or
// switched-off link must take effect immediately, so never cache this.
export const dynamic = "force-dynamic";

type Resolved = { organization_slug?: string; slug?: string; utm?: unknown };

/**
 * GET /s/{code} — short event link (docs/26). Resolves the code through the
 * API and 302s to the canonical event page, which keeps owning access control
 * and the OG tags crawlers read for link previews.
 *
 * The destination is built here from the slugs the API returns, never taken
 * from a URL it supplies, so this can't be turned into an open redirect.
 * Phase 2: the share channel tag (`?c=wa`) is forwarded to the API, which
 * buckets the click and returns the UTM tags for it; those are merged into
 * the destination (a sharer's own utm_* wins, only an allowlist of incoming
 * params is passed on).
 * Unknown / switched-off / not-public links land on /discover; an outage
 * (timeout, network error, 5xx) lands on a "try again" page instead.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  // Forward the real visitor's identity details: the API only sees this
  // server, so without them its crawler/HEAD/prefetch filtering would judge
  // our own fetch. It trusts them only alongside the proxy secret.
  const channel = (request.nextUrl.searchParams.get("c") ?? "").slice(0, 16);
  const query = channel ? `?c=${encodeURIComponent(channel)}` : "";
  const result = await backendRequest<Resolved>(`/api/public/short-links/${encodeURIComponent(code)}${query}`, {
    // A hung API must not hang every shared link; on timeout the visitor lands on /discover.
    timeoutMs: 5000,
    headers: {
      "X-Visitor-User-Agent": (request.headers.get("user-agent") ?? "").slice(0, 512),
      "X-Visitor-Method": request.method,
      "X-Visitor-Purpose": request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "",
    },
  }).catch(() => null);

  const canonical = result?.ok ? canonicalEventUrl(APP_URL, result.data?.organization_slug, result.data?.slug) : null;
  const destination = canonical
    ? buildShortLinkDestination(canonical, request.nextUrl.searchParams, result?.data?.utm)
    : new URL(fallbackPath(result?.status ?? null, code), APP_URL).toString();

  const response = NextResponse.redirect(destination, 302);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
