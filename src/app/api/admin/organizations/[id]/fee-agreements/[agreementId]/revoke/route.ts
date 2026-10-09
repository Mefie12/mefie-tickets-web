import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agreementId: string }> },
) {
  const { id, agreementId } = await params;
  const body = await request.json();
  const result = await backendRequest(
    `/api/admin/organizations/${encodeURIComponent(id)}/fee-agreements/${encodeURIComponent(agreementId)}/revoke`,
    { method: "PATCH", body },
  );
  return relayResponse(result);
}
