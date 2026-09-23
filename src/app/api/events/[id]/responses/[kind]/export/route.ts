import { NextRequest, NextResponse } from "next/server";
import { API_URL, APP_URL, currentCookieHeader } from "@/lib/backend";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (kind !== "orders" && kind !== "attendees") return new Response("Not found", { status: 404 });
  const cookie = await currentCookieHeader();
  const res = await fetch(`${API_URL}/api/events/${encodeURIComponent(id)}/responses/${kind}/export?${request.nextUrl.searchParams}`, {
    headers: { Cookie: cookie, Origin: APP_URL, Referer: `${APP_URL}/` }, cache: "no-store",
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ message: data?.message ?? "Export failed." }, { status: res.status });
  }
  return new NextResponse(res.body, { status: res.status, headers: {
    "Content-Type": res.headers.get("Content-Type") ?? "text/csv",
    "Content-Disposition": res.headers.get("Content-Disposition") ?? `attachment; filename=${kind}-responses.csv`,
    "Cache-Control": "no-store, private",
  } });
}
