import { NextRequest } from "next/server";
import { backendRequest } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/gates`));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return relayResponse(await backendRequest(`/api/events/${encodeURIComponent(id)}/gates`, {
    method: "POST", body: await request.json(),
  }));
}
