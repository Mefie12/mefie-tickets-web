import { cookies, headers } from "next/headers";
import { clientIpFromHeaders } from "@/lib/clientIp";

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
  /** Retry-After from the API (seconds), present on rate-limit responses. */
  retryAfter?: string | null;
  /** Correlation id sent to (and echoed by) the API; set by backendRequestResilient. */
  requestId?: string;
};

/** Budget for public form submissions (main call and the CSRF handshake each). */
export const PUBLIC_FORM_TIMEOUT_MS = 8000;

/**
 * Tells the API which visitor this server-to-server call is for (so its per-IP rate limits are per visitor),
 * authenticated by a secret the API shares with us. Sent only when both the secret and an address exist.
 */
async function proxyHeaders(): Promise<Record<string, string>> {
  const secret = process.env.API_PROXY_SECRET;
  if (!secret) return {};
  const ip = clientIpFromHeaders(await headers(), Number(process.env.CLIENT_IP_TRUSTED_HOPS ?? 1));
  return ip ? { "X-Client-IP": ip, "X-Web-Proxy-Secret": secret } : {};
}

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
  csrfTimeoutMs?: number,
): Promise<{ cookieHeader: string; xsrfToken?: string; setCookieHeaders: string[] }> {
  let cookieHeader = await currentCookieHeader();
  const setCookieHeaders: string[] = [];

  if (needsCsrf) {
    const csrfRes = await fetch(`${API_URL}/sanctum/csrf-cookie`, {
      headers: { Cookie: cookieHeader, Origin: APP_URL, Referer: `${APP_URL}/`, ...(await proxyHeaders()) },
      signal: csrfTimeoutMs ? AbortSignal.timeout(csrfTimeoutMs) : undefined,
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
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {},
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
      ...(await proxyHeaders()),
      ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
  });

  setCookieHeaders.push(...res.headers.getSetCookie());

  const data = (await res.json().catch(() => null)) as T;

  return { status: res.status, ok: res.ok, data, setCookieHeaders, retryAfter: res.headers.get("retry-after") };
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
      ...(await proxyHeaders()),
      ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
    },
    body: formData,
    cache: "no-store",
  });

  setCookieHeaders.push(...res.headers.getSetCookie());

  const data = (await res.json().catch(() => null)) as T;

  return { status: res.status, ok: res.ok, data, setCookieHeaders, retryAfter: res.headers.get("retry-after") };
}

/**
 * Opt-in variant of backendRequest for public forms: never throws. Network failures and timeouts become
 * a synthetic 503/504 result (code UPSTREAM_UNAVAILABLE / UPSTREAM_TIMEOUT) so callers can show a real
 * message instead of an empty body, and every call carries an X-Request-Id for support correlation.
 */
export async function backendRequestResilient<T = unknown>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<BackendResult<T>> {
  const method = options.method ?? "GET";
  const timeoutMs = options.timeoutMs ?? PUBLIC_FORM_TIMEOUT_MS;
  const requestId = crypto.randomUUID();

  try {
    const { cookieHeader, xsrfToken, setCookieHeaders } = await prepareAuthenticatedRequest(method !== "GET", timeoutMs);

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: cookieHeader,
        Origin: APP_URL,
        Referer: `${APP_URL}/`,
        "X-Request-Id": requestId,
        ...(await proxyHeaders()),
        ...(xsrfToken ? { "X-XSRF-TOKEN": xsrfToken } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    setCookieHeaders.push(...res.headers.getSetCookie());
    const data = (await res.json().catch(() => null)) as T;

    return {
      status: res.status,
      ok: res.ok,
      data,
      setCookieHeaders,
      retryAfter: res.headers.get("retry-after"),
      requestId: res.headers.get("x-request-id") ?? requestId,
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const timedOut = name === "TimeoutError" || name === "AbortError";
    return {
      ok: false,
      status: timedOut ? 504 : 503,
      data: {
        code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
        message: timedOut ? "The request timed out." : "The service is unavailable.",
      } as T,
      setCookieHeaders: [],
      requestId,
    };
  }
}
