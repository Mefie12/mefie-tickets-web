import { NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";
export async function GET(_: Request, { params }: { params: Promise<{ allocationId: string }> }) { const { allocationId } = await params; const r = await backendRequest(`/api/distributor/allocations/${allocationId}/history`); return NextResponse.json(r.data, { status: r.status }); }
