import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";

const ACTIONS = new Set(["resend", "revoke", "keep-venue"]);

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string; grantId: string; action: string }> }) {
  const { id, grantId, action } = await params;
  if (!ACTIONS.has(action)) return NextResponse.json({ message: "Not found." }, { status: 404 });
  const r = await backendRequest(`/api/events/${encodeURIComponent(id)}/venue-access/${encodeURIComponent(grantId)}/${action}`, { method: "POST", body: {} });
  return NextResponse.json(r.data, { status: r.status });
}
