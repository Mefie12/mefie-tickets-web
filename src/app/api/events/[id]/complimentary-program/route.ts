import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/complimentary-program`));
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/complimentary-program`, { method: "PUT", body: await request.json() }));
}
