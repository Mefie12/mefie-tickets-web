"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AcceptLegalDialog } from "@/components/AcceptLegalDialog";
import { ApiError } from "@/lib/authApi";
import { getOrganizationLegalPending, type OrganizerLegalDocument } from "@/lib/organizationLegalApi";

type GateState = { documents: OrganizerLegalDocument[]; admins: string[]; canAccept: boolean } | null;

/**
 * Wrap a request that can be refused with LEGAL_ACCEPTANCE_REQUIRED (publishing a paid event, adding a paid
 * ticket to a live one, setting up payouts). On that refusal the accept dialog opens; once accepted the
 * original request is retried automatically, so the organizer never has to repeat what they were doing.
 * Render `dialog` once next to the code that calls `guard`.
 */
export function useLegalGate(): { guard: <T>(run: () => Promise<T>) => Promise<T>; dialog: ReactNode } {
  const [state, setState] = useState<GateState>(null);
  const waiting = useRef<{ resolve: () => void; reject: (reason: unknown) => void } | null>(null);

  const guard = useCallback(async function guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "LEGAL_ACCEPTANCE_REQUIRED") throw error;
      const documents = (error.data?.documents as OrganizerLegalDocument[] | undefined) ?? [];
      const admins = (error.data?.admins as string[] | undefined) ?? [];
      // Ask who may accept: a teammate without the administrator role gets "ask an admin" instead of a dead button.
      const canAccept = await getOrganizationLegalPending().then((pending) => pending.can_accept).catch(() => true);
      await new Promise<void>((resolve, reject) => {
        waiting.current = { resolve, reject };
        setState({ documents, admins, canAccept });
      });
      return run();
    }
  }, []);

  const close = (outcome: "accepted" | "dismissed", original?: unknown) => {
    const pending = waiting.current;
    waiting.current = null;
    setState(null);
    if (outcome === "accepted") pending?.resolve();
    else pending?.reject(original);
  };

  const dialog = state ? (
    <AcceptLegalDialog
      opened
      documents={state.documents}
      admins={state.admins}
      canAccept={state.canAccept}
      onAccepted={() => close("accepted")}
      onClose={() => close("dismissed", new ApiError("Accept the organizer documents to continue.", 422, undefined, "LEGAL_ACCEPTANCE_DISMISSED"))}
    />
  ) : null;

  return { guard, dialog };
}
