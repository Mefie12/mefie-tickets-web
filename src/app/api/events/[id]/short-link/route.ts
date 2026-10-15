import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

const backendPath = (id: string) => `/api/events/${encodeURIComponent(id)}/short-link`;

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relayResponse(await backendRequest(backendPath(id)));
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relayResponse(await backendRequest(backendPath(id), { method: "POST" }));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relayResponse(await backendRequest(backendPath(id), { method: "PATCH", body: await request.json() }));
}
