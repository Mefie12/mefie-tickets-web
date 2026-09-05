import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";
export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (!["request", "verify", "complete"].includes(action)) return new Response("Not found", { status: 404 });
  return relayResponse(await backendRequest(`/api/public/consumer/account/${action}`, { method: "POST", body: await request.json().catch(() => ({})) }));
}
