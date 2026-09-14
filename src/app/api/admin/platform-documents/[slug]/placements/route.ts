import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/admin/platform-legal-documents/${encodeURIComponent(slug)}/placements`, {
    method: "PUT",
    body,
  });
  return relayResponse(result);
}
