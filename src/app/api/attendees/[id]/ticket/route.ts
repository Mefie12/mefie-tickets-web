import { NextRequest, NextResponse } from "next/server";
import { API_URL, APP_URL, currentCookieHeader } from "@/lib/backend";

/**
 * Streams the generated ticket PDF back through the BFF — not a plain
 * JSON proxy like backendRequest, since the browser never talks to
 * Laravel directly (see backend.ts) and this response body is binary.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = await currentCookieHeader();

  const res = await fetch(`${API_URL}/api/attendees/${encodeURIComponent(id)}/ticket`, {
    headers: { Cookie: cookieHeader, Origin: APP_URL, Referer: `${APP_URL}/` },
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ message: data?.message ?? "Ticket not found." }, { status: res.status });
  }

  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/pdf",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? "attachment; filename=ticket.pdf",
    },
  });
}
