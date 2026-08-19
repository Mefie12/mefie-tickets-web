import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";
const actions = new Set(["resend", "revoke", "suspend", "resume", "close"]);
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string; allocationId: string; action: string }> }) {
  const { id, allocationId, action } = await params;
  if (!actions.has(action)) return NextResponse.json({ message: "Unknown allocation action." }, { status: 404 });
  const r = await backendRequest(`/api/events/${id}/complimentary-allocations/${allocationId}/${action}`, { method: "POST" });
  return NextResponse.json(r.data, { status: r.status });
}
