"use client";

import { use } from "react";
import { GateCheckIn } from "@/components/GateCheckIn";
import { readGateSession } from "@/lib/gateSession";

export default function GateRosterPage({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = use(params);
  const session = readGateSession();

  return <GateCheckIn shortId={shortId} capabilities={session?.capabilities ?? ["check-in"]} />;
}
