import { NextRequest } from "next/server";
import { backendUpload } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const result = await backendUpload(`/api/organization/talent/${encodeURIComponent(id)}/image`, formData);
  return relayResponse(result);
}
