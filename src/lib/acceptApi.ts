/**
 * Public personal-acceptance flow. The preview is read server-side from
 * the `mefie_accept_preview` cookie; this client only submits the
 * confirmation, tied to the resolved token via `mefie_accept_flow`.
 */
import { ApiError } from "@/lib/authApi";

export type AcceptPreview = {
  attendee_first_name: string | null;
  inviter_name: string | null;
  event: { title: string | null; start_date: string | null; timezone: string | null };
  ticket: { name: string | null; option: string | null };
};

export const submitAccept = async (attestationText?: string): Promise<{ status: "accepted" }> => {
  const res = await fetch("/api/public/accept/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accepted: true, attestation_text: attestationText }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }
  return data as { status: "accepted" };
};
