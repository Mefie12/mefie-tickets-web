import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const { id, questionId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const { id, questionId } = await params;
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/questions/${encodeURIComponent(questionId)}`,
    { method: "DELETE" },
  );
  return relayResponse(result);
}
