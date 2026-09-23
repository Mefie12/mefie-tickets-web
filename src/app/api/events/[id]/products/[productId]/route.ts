import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  const { id, productId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/products/${encodeURIComponent(productId)}`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; productId: string }> },
) {
  const { id, productId } = await params;
  const result = await backendRequest(
    `/api/events/${encodeURIComponent(id)}/products/${encodeURIComponent(productId)}`,
    { method: "DELETE" },
  );
  return relayResponse(result);
}
