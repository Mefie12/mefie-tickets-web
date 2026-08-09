import { NextRequest } from "next/server";
import { backendRequest, backendUpload } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await request.formData();
  const result = await backendUpload(`/api/events/${encodeURIComponent(id)}/media/cover`, formData);
  return relayResponse(result);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await backendRequest(`/api/events/${encodeURIComponent(id)}/media/cover`, { method: "DELETE" });
  return relayResponse(result);
}
