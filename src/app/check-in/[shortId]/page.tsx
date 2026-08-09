import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import type { CheckInListPayload } from "@/lib/publicCheckInApi";
import { GateCheckIn } from "@/components/GateCheckIn";

export default async function GateCheckInPage({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;

  const result = await backendRequest<CheckInListPayload>(`/api/public/check-in-lists/${shortId}`);

  if (result.status !== 200) {
    notFound();
  }

  return <GateCheckIn shortId={shortId} initialData={result.data} />;
}
