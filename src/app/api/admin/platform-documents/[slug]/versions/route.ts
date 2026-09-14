import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await request.json();
  const result = await backendRequest(`/api/admin/platform-legal-documents/${encodeURIComponent(slug)}/versions`, {
    method: "POST",
    body,
  });
  return relayResponse(result);
}
