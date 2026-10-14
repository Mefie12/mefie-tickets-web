/**
 * Short event links (docs/26). Pure helpers shared by the /s/{code} redirect
 * route and the organizer UI, plus the browser-side API client.
 */
import { ApiError } from "@/lib/authApi";

export type ShortLinkTarget = "events" | "event-series";

export type ShortLink = {
  code: string;
  alias: string | null;
  short_url: string;
  enabled: boolean;
  disabled_by_admin: boolean;
  /** The platform retired this link's custom alias and blocks setting another. */
  alias_locked: boolean;
  click_count: number;
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
