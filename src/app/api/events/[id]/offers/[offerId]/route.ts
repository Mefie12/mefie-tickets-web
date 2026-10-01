import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

type Ctx = { params: Promise<{ id: string; offerId: string }> };
const path = (id: string, offerId: string) => `/api/events/${encodeURIComponent(id)}/offers/${encodeURIComponent(offerId)}`;

export async function GET(_: NextRequest, { params }: Ctx) {
  const { id, offerId } = await params;
  return relayResponse(await backendRequest(path(id, offerId)));
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id, offerId } = await params;
  return relayResponse(await backendRequest(path(id, offerId), { method: "PATCH", body: await request.json() }));
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const { id, offerId } = await params;
  return relayResponse(await backendRequest(path(id, offerId), { method: "DELETE" }));
}
