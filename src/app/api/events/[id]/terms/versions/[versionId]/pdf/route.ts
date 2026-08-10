import { NextRequest, NextResponse } from "next/server";
import { API_URL, APP_URL, currentCookieHeader } from "@/lib/backend";

/**
 * Streams an organizer-facing terms PDF (current or historical) back
 * through the BFF — binary passthrough, same shape as
 * /api/attendees/[id]/ticket, since the browser never talks to Laravel
 * directly (see backend.ts).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const cookieHeader = await currentCookieHeader();

  const res = await fetch(
    `${API_URL}/api/events/${encodeURIComponent(id)}/terms/versions/${encodeURIComponent(versionId)}/pdf`,
    { headers: { Cookie: cookieHeader, Origin: APP_URL, Referer: `${APP_URL}/` }, cache: "no-store" },
  );

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
