import { NextResponse } from "next/server";
import { backendRequest } from "@/lib/backend";

export async function GET() {
  const r = await backendRequest("/api/venue/events");
  return NextResponse.json(r.data, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
