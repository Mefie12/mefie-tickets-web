import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await backendRequest(`/api/events/${encodeURIComponent(id)}/venue-access`);
  return NextResponse.json(r.data, { status: r.status });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await backendRequest(`/api/events/${encodeURIComponent(id)}/venue-access`, { method: "POST", body: await request.json().catch(() => ({})) });
  return NextResponse.json(r.data, { status: r.status });
}
