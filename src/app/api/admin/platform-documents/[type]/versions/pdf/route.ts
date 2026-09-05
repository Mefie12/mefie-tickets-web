import { NextRequest } from "next/server";
import { backendUpload } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const formData = await request.formData();
  const result = await backendUpload(`/api/admin/platform-documents/${encodeURIComponent(type)}/versions/pdf`, formData);
  return relayResponse(result);
}
