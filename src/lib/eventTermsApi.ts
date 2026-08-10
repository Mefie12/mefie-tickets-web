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
  options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
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

export function createTermsVersion(eventId: number, richTextContent: string) {
  return request<{ version: EventTermsVersion }>(`/api/events/${eventId}/terms/versions`, {
    method: "POST",
    body: { rich_text_content: richTextContent },
  });
}

export function createPdfTermsVersion(eventId: number, file: File) {
  const formData = new FormData();
  formData.append("document", file);
  return upload<{ version: EventTermsVersion }>(`/api/events/${eventId}/terms/versions/pdf`, formData);
}

export function updateTermsVersion(eventId: number, versionId: number, richTextContent: string) {
  return request<{ version: EventTermsVersion }>(`/api/events/${eventId}/terms/versions/${versionId}`, {
    method: "PATCH",
    body: { rich_text_content: richTextContent },
  });
}

export function publishTermsVersion(eventId: number, versionId: number) {
  return request<{ version: EventTermsVersion }>(`/api/events/${eventId}/terms/versions/${versionId}/publish`, {
    method: "PATCH",
  });
}
