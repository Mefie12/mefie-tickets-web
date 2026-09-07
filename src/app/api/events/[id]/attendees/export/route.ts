import { NextRequest, NextResponse } from "next/server";
import { API_URL, APP_URL, currentCookieHeader } from "@/lib/backend";

/** Streams the attendees CSV export back through the BFF — binary passthrough. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieHeader = await currentCookieHeader();

  const res = await fetch(
    `${API_URL}/api/events/${encodeURIComponent(id)}/attendees/export?${request.nextUrl.searchParams}`,
    { headers: { Cookie: cookieHeader, Origin: APP_URL, Referer: `${APP_URL}/` }, cache: "no-store" },
  );

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ message: data?.message ?? "Export failed." }, { status: res.status });
  }

  return new NextResponse(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "text/csv",
      "Content-Disposition": res.headers.get("Content-Disposition") ?? "attachment; filename=attendees.csv",
      "Cache-Control": "no-store, private",
    },
  });
}
