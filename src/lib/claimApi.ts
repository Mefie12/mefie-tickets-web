/**
 * Public guest-claim flow. The preview payload is read server-side from
 * the `mefie_claim_preview` cookie (see src/lib/tokenEntry.ts); this
 * client only submits the claim, which the backend ties to the resolved
 * link via the `mefie_claim_flow` cookie.
 */
import { ApiError } from "@/lib/authApi";
import type { AnswerInput } from "@/lib/checkoutApi";

export type ClaimPreviewQuestion = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  options: string[] | null;
  is_required: boolean;
};

export type ClaimPreview = {
  inviter_first_name: string | null;
  event: { title: string | null; start_date: string | null; timezone: string | null };
  ticket: { name: string | null; option: string | null };
  requires_personal_acceptance: boolean;
  attendee_questions: ClaimPreviewQuestion[];
  delivery_locked: boolean;
  masked_delivery_email: string | null;
};

export type ClaimBody = {
  self: false;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  delivery_relationship?: string | null;
  delivery_name?: string | null;
  delivery_email?: string | null;
  delivery_phone?: string | null;
  answers?: AnswerInput[];
  guardian_attestation?: boolean;
};

export const submitClaim = async (body: ClaimBody): Promise<{ status: "claimed" }> => {
  const res = await fetch("/api/public/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }
  return data as { status: "claimed" };
};
