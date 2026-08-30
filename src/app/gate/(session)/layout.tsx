"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Center, Loader } from "@mantine/core";
import { GateShell } from "@/components/GateShell";
import { readGateSession } from "@/lib/gateSession";
import type { GateSessionInfo } from "@/lib/gateApi";

/**
 * Client guard for the signed-in gate app. The HttpOnly
 * mefie_gate_session cookie is the real boundary (Laravel enforces it on
 * every /api/gate call and any 401 bounces here); this just routes the
 * operator back to sign-in when there's clearly no session and renders
 * the right controls for their role.
 */
export default function GateSessionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<GateSessionInfo | null | undefined>(undefined);

  useEffect(() => {
    // One-shot read of the sessionStorage hint on mount (client only).
    const info = readGateSession();
    if (!info) {
      router.replace("/gate");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(info);
  }, [router]);

  if (session === undefined || session === null) {
    return (
      <Center mih="100dvh">
        <Loader />
      </Center>
    );
  }

  return <GateShell session={session}>{children}</GateShell>;
}
