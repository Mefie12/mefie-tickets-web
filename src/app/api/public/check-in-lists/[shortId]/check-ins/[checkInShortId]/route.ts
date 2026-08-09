import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shortId: string; checkInShortId: string }> },
) {
  const { shortId, checkInShortId } = await params;
  const result = await backendRequest(
    `/api/public/check-in-lists/${encodeURIComponent(shortId)}/check-ins/${encodeURIComponent(checkInShortId)}`,
    { method: "DELETE" },
  );
  return relayResponse(result);
}
