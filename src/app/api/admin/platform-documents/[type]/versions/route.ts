import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/admin/platform-documents/${encodeURIComponent(type)}/versions`, {
    method: "POST",
    body,
  });
  return relayResponse(result);
}
