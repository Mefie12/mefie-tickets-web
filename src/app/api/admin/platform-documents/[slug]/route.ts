import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await backendRequest(`/api/admin/platform-legal-documents/${encodeURIComponent(slug)}`);
  return relayResponse(result);
}
