import { NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";
export async function GET() { const r = await backendRequest("/api/distributor/allocations"); return NextResponse.json(r.data, { status: r.status }); }
