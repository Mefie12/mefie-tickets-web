import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";
export async function POST(request: NextRequest, { params }: { params: Promise<{ allocationId: string }> }) { const { allocationId } = await params; const r = await backendRequest(`/api/distributor/allocations/${allocationId}/returns`, { method: "POST", body: await request.json() }); return NextResponse.json(r.data, { status: r.status }); }
