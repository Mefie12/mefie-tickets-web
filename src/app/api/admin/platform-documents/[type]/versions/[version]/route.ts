import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ type: string; version: string }> }) {
  const { type, version } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/admin/platform-documents/${encodeURIComponent(type)}/versions/${encodeURIComponent(version)}`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}
