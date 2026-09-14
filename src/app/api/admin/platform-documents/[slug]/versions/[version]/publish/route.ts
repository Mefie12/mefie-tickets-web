import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string; version: string }> }) {
  const { slug, version } = await params;
  const result = await backendRequest(
    `/api/admin/platform-legal-documents/${encodeURIComponent(slug)}/versions/${encodeURIComponent(version)}/publish`,
    { method: "PATCH" },
  );
  return relayResponse(result);
}
