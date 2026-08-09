import { cookies } from "next/headers";

/**
 * Server-only Sanctum SPA cookie relay.
 *
 * Per 00_mefie_tickets_system_architecture.md Section 5.2, the auth
 * session cookie is issued/validated by Laravel and read on the server
 * by Next.js — never exposed to client-side JS. That means the browser
 * only ever talks to our own Route Handlers (same origin); this module
 * is what actually forwards the browser's cookies to Laravel, performs
 * the Sanctum CSRF handshake, and relays Laravel's Set-Cookie headers
 * back so the browser's cookie jar stays in sync.
 *
 * This is the piece explicitly called out as deferred/highest-risk when
 * Milestone 2's backend work was split from its frontend follow-up.
 */

export const API_URL = process.env.API_URL ?? "http://localhost:8000";
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export type BackendResult<T> = {
  status: number;
  ok: boolean;
  data: T;
  setCookieHeaders: string[];
};

function parseCookiePairs(cookieHeaderOrSetCookies: string[]): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const raw of cookieHeaderOrSetCookies) {
    // A Set-Cookie string's first segment is the name=value pair; the
    // rest (Path=, Expires=, etc.) isn't needed for outgoing requests.
    const firstSegment = raw.split(";")[0];
    const eq = firstSegment.indexOf("=");
    if (eq === -1) continue;
    const name = firstSegment.slice(0, eq).trim();
    const value = firstSegment.slice(eq + 1).trim();
    pairs.set(name, value);
  }
  return pairs;
}

export async function currentCookieHeader(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

function mergeCookieHeader(existingHeader: string, setCookies: string[]): string {
  const merged = parseCookiePairs(
    existingHeader
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  for (const [name, value] of parseCookiePairs(setCookies)) {
    merged.set(name, value);
  }
  return Array.from(merged.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function extractXsrfToken(cookieHeader: string): string | undefined {
  const match = cookieHeader.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Shared by backendRequest/backendUpload: forwards the browser's cookies
 * and, for state-changing methods, performs the Sanctum CSRF handshake
 * to get a fresh XSRF token. Returns the cookie header to send and the
 * Set-Cookie headers collected so far (from the handshake itself).
 */
async function prepareAuthenticatedRequest(
  needsCsrf: boolean,
): Promise<{ cookieHeader: string; xsrfToken?: string; setCookieHeaders: string[] }> {
  let cookieHeader = await currentCookieHeader();
  const setCookieHeaders: string[] = [];

  if (needsCsrf) {
    const csrfRes = await fetch(`${API_URL}/sanctum/csrf-cookie`, {
      headers: { Cookie: cookieHeader, Origin: APP_URL, Referer: `${APP_URL}/` },
    });
    const csrfSetCookies = csrfRes.headers.getSetCookie();
    setCookieHeaders.push(...csrfSetCookies);
    cookieHeader = mergeCookieHeader(cookieHeader, csrfSetCookies);
  }

  return { cookieHeader, xsrfToken: extractXsrfToken(cookieHeader), setCookieHeaders };
}

/**
 * Calls the Laravel API on behalf of the current request, forwarding the
 * browser's cookies and (for state-changing methods) a fresh Sanctum
 * CSRF token. Returns the raw Set-Cookie headers Laravel sent back so
 * the caller (a Route Handler) can relay them onto its own response.
 */
export async function backendRequest<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<BackendResult<T>> {
  const method = options.method ?? "GET";
  const { cookieHeader, xsrfToken, setCookieHeaders } = await prepareAuthenticatedRequest(method !== "GET");

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: cookieHeader,
      Origin: APP_URL,
      Referer: `${APP_URL}/`,
      ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  setCookieHeaders.push(...res.headers.getSetCookie());

  const data = (await res.json().catch(() => null)) as T;

  return { status: res.status, ok: res.ok, data, setCookieHeaders };
}

/**
 * Same relay, for multipart file uploads (organizer logo/cover image).
 * No Content-Type header is set manually — fetch generates the
 * multipart boundary itself from the FormData body.
 */
export async function backendUpload<T = unknown>(path: string, formData: FormData): Promise<BackendResult<T>> {
  const { cookieHeader, xsrfToken, setCookieHeaders } = await prepareAuthenticatedRequest(true);

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Cookie: cookieHeader,
      Origin: APP_URL,
      Referer: `${APP_URL}/`,
      ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
    },
    body: formData,
    cache: "no-store",
  });

  setCookieHeaders.push(...res.headers.getSetCookie());

  const data = (await res.json().catch(() => null)) as T;

  return { status: res.status, ok: res.ok, data, setCookieHeaders };
}
