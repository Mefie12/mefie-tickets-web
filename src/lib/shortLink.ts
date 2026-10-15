/**
 * Short event links (docs/26). Pure helpers shared by the /s/{code} redirect
 * route and the organizer UI, plus the browser-side API client.
 */
import { ApiError } from "@/lib/authApi";

export type ShortLinkTarget = "events" | "event-series";

export type ShortLinkChannelStat = {
  channel: string;
  label: string;
  all_time: number;
  last_30: number;
  last_7: number;
};

export type ShortLink = {
  code: string;
  alias: string | null;
  short_url: string;
  enabled: boolean;
  disabled_by_admin: boolean;
  /** The platform retired this link's custom alias and blocks setting another. */
  alias_locked: boolean;
  click_count: number;
  /** Clicks per share channel (all-time / last 30 / last 7 UTC days); only channels with clicks. */
  channels: ShortLinkChannelStat[];
  last_clicked_at: string | null;
};

/** Mirrors ShortLinkService::assertAliasAvailable() — the server stays the authority. */
const ALIAS_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeAlias(input: string): string {
  return input.trim().toLowerCase();
}

/** Returns an error message, or null when the (normalized) alias is acceptable. Empty is valid: it clears the alias. */
export function validateAlias(input: string): string | null {
  const alias = normalizeAlias(input);
  if (alias === "") return null;
  if (alias.length < 3 || alias.length > 30 || !ALIAS_PATTERN.test(alias)) return "Use 3–30 lowercase letters, numbers or single hyphens, not starting or ending with a hyphen.";
  return null;
}

/** A short code is lowercase letters, digits and single hyphens (see ALIAS_PATTERN, plus the 6-char auto codes). */
export function isPlausibleShortCode(code: unknown): code is string {
  return typeof code === "string" && code.length >= 3 && code.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code);
}

/**
 * Where /s/{code} sends a visitor when the lookup did not return a
 * destination. A definite "no such link" (404, or throttled misses) goes to
 * /discover; anything else (timeout, network error, 5xx) is an outage and
 * gets a "try again" page so the visitor isn't told the link is dead.
 */
export function fallbackPath(status: number | null, code: string): string {
  if (status === 404 || status === 429 || (status !== null && status >= 200 && status < 300)) return "/discover";
  return isPlausibleShortCode(code.toLowerCase()) ? `/link-unavailable?code=${encodeURIComponent(code.toLowerCase())}` : "/link-unavailable";
}

/**
 * Builds the canonical event URL the short link redirects to. Built from the
 * slugs the API returned — never from a URL the API supplied — and then
 * asserted to be same-origin as appUrl, so a tampered response can never turn
 * /s/{code} into an open redirect. Returns null when it can't be trusted.
 */
export function canonicalEventUrl(appUrl: string, organizationSlug: unknown, slug: unknown): string | null {
  if (typeof organizationSlug !== "string" || typeof slug !== "string" || !organizationSlug || !slug) return null;
  try {
    const base = new URL(appUrl);
    const target = new URL(`/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(slug)}`, base);
    return target.origin === base.origin ? target.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Share channels (docs/26, Phase 2). `code` is the value of the `?c=` tag the
 * API validates against its own allowlist (config/short_links.php); `kind`
 * says whether the platform has a web share link or only a copyable link.
 */
export const SHARE_CHANNELS = [
  { code: "wa", label: "WhatsApp", kind: "intent" },
  { code: "fb", label: "Facebook", kind: "intent" },
  { code: "x", label: "X (Twitter)", kind: "intent" },
  { code: "tg", label: "Telegram", kind: "intent" },
  { code: "li", label: "LinkedIn", kind: "intent" },
  { code: "em", label: "Email", kind: "intent" },
  { code: "ig", label: "Instagram", kind: "copy" },
  { code: "tt", label: "TikTok", kind: "copy" },
] as const;

export type ShareChannelCode = (typeof SHARE_CHANNELS)[number]["code"];

/** The short URL tagged with the share channel, e.g. `https://…/s/abc123?c=wa`. */
export function taggedShortUrl(shortUrl: string, channel: ShareChannelCode): string {
  return `${shortUrl}${shortUrl.includes("?") ? "&" : "?"}c=${channel}`;
}

/**
 * The platform's web share link for a channel, or null for copy-only
 * channels (Instagram, TikTok have none). `url` must already be tagged.
 */
export function shareIntentUrl(channel: ShareChannelCode, url: string, title: string, text = ""): string | null {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  switch (channel) {
    case "wa":
      return `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;
    case "fb":
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case "x":
      return `https://twitter.com/intent/tweet?url=${u}&text=${t}`;
    case "tg":
      return `https://t.me/share/url?url=${u}&text=${t}`;
    case "li":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    case "em":
      return `mailto:?subject=${t}&body=${encodeURIComponent(text ? `${text}\n\n${url}` : url)}`;
    default:
      return null;
  }
}

const PASS_THROUGH_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "ttclid", "msclkid"] as const;
const FILL_PARAMS = ["utm_source", "utm_medium", "utm_campaign"] as const;
const MAX_PARAM_LENGTH = 200;

/** Query values from outside are untrusted: strip control characters, trim, cap the length. */
function cleanParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, MAX_PARAM_LENGTH);
  return cleaned === "" ? null : cleaned;
}

/**
 * Adds campaign tags to the canonical event URL for /s/{code} (Phase 2).
 *
 * Only an allowlist of incoming params is passed through (UTMs and the ad
 * platforms' click ids); anything else a sharer added is dropped. A sharer's
 * own utm_* wins; the API's channel UTMs only fill the gaps. The `c` tag is
 * never forwarded. The path/origin of `canonicalUrl` is never touched.
 */
export function buildShortLinkDestination(canonicalUrl: string, incoming: URLSearchParams, apiUtm: unknown): string {
  const url = new URL(canonicalUrl);
  for (const key of PASS_THROUGH_PARAMS) {
    const value = cleanParam(incoming.get(key));
    if (value !== null) url.searchParams.set(key, value);
  }
  const defaults = apiUtm && typeof apiUtm === "object" ? (apiUtm as Record<string, unknown>) : {};
  for (const key of FILL_PARAMS) {
    if (url.searchParams.has(key)) continue;
    const value = cleanParam(defaults[key]);
    if (value !== null) url.searchParams.set(key, value);
  }
  return url.toString();
}

async function request<T>(path: string, method: "GET" | "POST" | "PATCH", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  return data as T;
}

const path = (target: ShortLinkTarget, id: number) => `/api/${target}/${id}/short-link`;

export const fetchShortLink = (target: ShortLinkTarget, id: number) =>
  request<{ short_link: ShortLink | null }>(path(target, id), "GET").then((r) => r.short_link);

export const createShortLink = (target: ShortLinkTarget, id: number) =>
  request<{ short_link: ShortLink }>(path(target, id), "POST").then((r) => r.short_link);

export const updateShortLink = (target: ShortLinkTarget, id: number, changes: { enabled?: boolean; alias?: string | null }) =>
  request<{ short_link: ShortLink }>(path(target, id), "PATCH", changes).then((r) => r.short_link);
