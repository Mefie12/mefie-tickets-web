import { NextRequest, NextResponse } from "next/server";
import { API_URL, APP_URL, currentCookieHeader } from "@/lib/backend";

/**
 * Unauthenticated public PDF stream — mirrors the organizer-facing
 * /api/events/[id]/terms/versions/[versionId]/pdf route's binary
 * passthrough shape, but always serves the event's current published
 * version (see DownloadPublicTermsPdfAction on the backend).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const cookieHeader = await currentCookieHeader();

  const res = await fetch(`${API_URL}/api/public/events/${encodeURIComponent(eventId)}/terms/pdf`, {
    headers: { Cookie: cookieHeader, Origin: APP_URL, Referer: `${APP_URL}/` },
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ message: data?.message ?? "PDF not found." }, { status: res.status });
  }

  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/pdf",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? "inline; filename=terms-and-conditions.pdf",
    },
  });
}
