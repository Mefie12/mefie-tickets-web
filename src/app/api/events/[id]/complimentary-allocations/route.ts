import { NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const r = await backendRequest(`/api/events/${id}/complimentary-allocations`); return NextResponse.json(r.data, { status: r.status }); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const r = await backendRequest(`/api/events/${id}/complimentary-allocations`, { method: "POST", body: await request.json() }); return NextResponse.json(r.data, { status: r.status }); }
