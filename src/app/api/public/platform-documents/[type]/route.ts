import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const result = await backendRequest(`/api/public/platform-documents/${encodeURIComponent(type)}`);
  return relayResponse(result);
}
