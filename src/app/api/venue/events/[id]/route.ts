import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await backendRequest(`/api/venue/events/${encodeURIComponent(id)}`);
  return NextResponse.json(r.data, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
