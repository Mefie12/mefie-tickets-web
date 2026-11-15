import { ApiError } from "@/lib/authApi";

export type TermsContentType = "RICH_TEXT" | "PDF";
export type TermsVersionStatus = "DRAFT" | "PUBLISHED";

export type EventTermsVersion = {
  id: number;
  event_terms_id: number;
  event_id: number;
  organization_id: string;
  version_number: number;
  content_type: TermsContentType;
  rich_text_content: string | null;
  status: TermsVersionStatus;
  published_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  /** Orders that accepted this version at checkout (only on the terms listing). */
  acceptances_count?: number;
};

export type EventTerms = {
  id: number;
  organization_id: string;
  event_id: number;
  enabled: boolean;
  current_version_id: number | null;
  current_version: EventTermsVersion | null;
  versions?: EventTermsVersion[];
  created_at: string;
  updated_at: string;
};

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Upload failed.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

export function getEventTerms(eventId: number) {
  return request<{ terms: EventTerms | null }>(`/api/events/${eventId}/terms`);
}

export function updateTermsConfig(eventId: number, enabled: boolean) {
  return request<{ terms: EventTerms }>(`/api/events/${eventId}/terms`, { method: "PATCH", body: { enabled } });
}

/** `replaceDraft` swaps the open draft for this one (switching between writing and a PDF) in a single step. */
export function createTermsVersion(eventId: number, richTextContent: string, replaceDraft = false) {
  return request<{ version: EventTermsVersion }>(`/api/events/${eventId}/terms/versions`, {
    method: "POST",
    body: { rich_text_content: richTextContent, replace_draft: replaceDraft },
  });
}

export function createPdfTermsVersion(eventId: number, file: File, replaceDraft = false) {
  const formData = new FormData();
  formData.append("document", file);
  if (replaceDraft) formData.append("replace_draft", "1");
  return upload<{ version: EventTermsVersion }>(`/api/events/${eventId}/terms/versions/pdf`, formData);
}

export function updateTermsVersion(eventId: number, versionId: number, richTextContent: string) {
  return request<{ version: EventTermsVersion }>(`/api/events/${eventId}/terms/versions/${versionId}`, {
    method: "PATCH",
    body: { rich_text_content: richTextContent },
  });
}

/** `requireAcceptance` sets the "require at checkout" switch in the same step; omit it to leave the switch as it is. */
export function publishTermsVersion(eventId: number, versionId: number, requireAcceptance?: boolean) {
  return request<{ version: EventTermsVersion }>(`/api/events/${eventId}/terms/versions/${versionId}/publish`, {
    method: "PATCH",
    body: requireAcceptance === undefined ? {} : { require_acceptance: requireAcceptance },
  });
}

export function discardTermsDraft(eventId: number, versionId: number) {
  return request<{ discarded: true }>(`/api/events/${eventId}/terms/versions/${versionId}`, { method: "DELETE" });
}

export type TermsCopySource = {
  event_id: number;
  event_title: string | null;
  event_start_date: string | null;
  version_number: number;
  content_type: TermsContentType;
  published_at: string | null;
};

export function getTermsCopySources(eventId: number) {
  return request<{ sources: TermsCopySource[] }>(`/api/events/${eventId}/terms/sources`);
}

export function copyTermsFromEvent(eventId: number, sourceEventId: number) {
  return request<{ version: EventTermsVersion }>(`/api/events/${eventId}/terms/versions/copy`, {
    method: "POST",
    body: { source_event_id: sourceEventId },
  });
}
