import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = request.nextUrl.searchParams.get("page") ?? "1";
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/orders?page=${encodeURIComponent(page)}`,
    { method: "GET" },
  );
  return relayResponse(result);
}
