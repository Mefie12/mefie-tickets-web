import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string; version: string }> }) {
  const { slug, version } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/admin/platform-legal-documents/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version)}`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}
