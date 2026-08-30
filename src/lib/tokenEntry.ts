import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";

/**
 * Shared token-exchange entry handler (docs/17 §18). The raw token
 * arrives once on this GET; we hand it to Laravel, collect the
 * short-lived HttpOnly flow cookie it mints, and immediately 302 to a
 * token-free URL so the token never reaches a client script, a form
 * body, an analytics call, or the browser history beyond this hop.
 *
 * The privacy-minimised preview JSON Laravel returns (masked emails,
 * first names — never a raw token or full PII) is stashed in a second
 * short-lived HttpOnly cookie so the token-free continue page can render
 * without another round trip and without a query string.
 */
export async function handleTokenEntry(
  request: NextRequest,
  {
    backendPath,
    previewCookie,
    resolveDestination,
  }: {
    backendPath: string;
    previewCookie: { name: string; minutes: number } | null;
    resolveDestination: (status: string, httpStatus: number) => string;
  },
): Promise<NextResponse> {
  const result = await backendRequest<{ status?: string } & Record<string, unknown>>(backendPath, { method: "GET" });

  const status = typeof result.data?.status === "string" ? result.data.status : "notfound";
  const destination = resolveDestination(result.ok ? status : "notfound", result.status);

  const response = NextResponse.redirect(new URL(destination, request.url), { status: 303 });

  // Re-set each backend cookie through NextResponse.cookies (rather than
  // a raw headers.append) — on a redirect response Next only reliably
  // emits Set-Cookie written this way.
  for (const raw of result.setCookieHeaders) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const lower = raw.toLowerCase();
    response.cookies.set(name, value, {
      httpOnly: lower.includes("httponly"),
      sameSite: lower.includes("samesite=strict") ? "strict" : lower.includes("samesite=none") ? "none" : "lax",
      secure: lower.includes("secure"),
      path: "/",
    });
  }

  if (previewCookie && result.ok) {
    // Strip the flow-control field; keep only the render payload.
    const { status: _status, ...preview } = result.data ?? {};
    void _status;
    response.cookies.set(previewCookie.name, JSON.stringify(preview), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: previewCookie.minutes * 60,
    });
  }

  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");

  return response;
}

/** Reads and clears a preview cookie written by handleTokenEntry. */
export async function readPreviewCookie<T>(name: string): Promise<T | null> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const raw = jar.get(name)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
