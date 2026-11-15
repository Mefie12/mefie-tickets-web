import { buildApiError } from "@/lib/authApi";

export type OrganizerLegalDocument = {
  version_id: number;
  name: string;
  slug: string;
  version_number: number;
  content_type: "RICH_TEXT" | "PDF";
  rich_text_content: string | null;
  published_at: string | null;
  /** When this document starts to block paid-event publishing; null if it already does. */
  enforced_from: string | null;
};

export type LegalNotice = {
  version_id: number;
  name: string;
  slug: string;
  version_number: number;
  change_summary: string | null;
  effective_at: string | null;
  notified_at: string;
};

export type OrganizationLegalPending = {
  to_accept: OrganizerLegalDocument[];
  blocking: boolean;
  notices: LegalNotice[];
  can_accept: boolean;
  admins: string[];
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw buildApiError(res, data);
  return data as T;
}

export const getOrganizationLegalPending = () => call<OrganizationLegalPending>("/api/organization/legal/pending");
export const acceptOrganizerDocuments = (versionIds: number[]) => call<{ accepted: number[] }>("/api/organization/legal/accept", { version_ids: versionIds });
export const acknowledgeLegalNotices = (versionIds: number[]) => call<{ acknowledged: number[] }>("/api/organization/legal/acknowledge", { version_ids: versionIds });
