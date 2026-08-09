import { NextRequest } from "next/server";
import { backendUpload } from "@/lib/backend";
import { relayResponse } from "@/lib/relayResponse";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const result = await backendUpload("/api/organization/logo", formData);
  return relayResponse(result);
}
