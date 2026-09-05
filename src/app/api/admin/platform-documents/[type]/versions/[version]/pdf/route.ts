import { NextRequest, NextResponse } from "next/server";
import { API_URL, APP_URL, currentCookieHeader } from "@/lib/backend";

/**
 * Streams an admin-facing platform-document PDF (current or historical)
 * back through the BFF — binary passthrough, same shape as
 * /api/events/[id]/terms/versions/[versionId]/pdf.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string; version: string }> }) {
  const { type, version } = await params;
  const cookieHeader = await currentCookieHeader();

  const res = await fetch(
    `${API_URL}/api/admin/platform-documents/${encodeURIComponent(type)}/versions/${encodeURIComponent(version)}/pdf`,
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
      "Content-Disposition": res.headers.get("Content-Disposition") ?? "inline; filename=document.pdf",
    },
  });
}
