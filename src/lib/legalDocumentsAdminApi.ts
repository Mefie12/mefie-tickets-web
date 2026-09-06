import { ApiError } from "@/lib/authApi";

export type TermsContentType = "RICH_TEXT" | "PDF";
export type TermsVersionStatus = "DRAFT" | "PUBLISHED";

export type LegalDocumentVersion = {
  id: number;
  platform_legal_document_id: number;
  version_number: number;
  content_type: TermsContentType;
  rich_text_content: string | null;
  status: TermsVersionStatus;
  published_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type LegalDocumentPlacement = {
  id: number;
  platform_legal_document_id: number;
  placement: LegalDocumentPlacementSlugUpper;
  sort_order: number;
};

/** The enum's own casing, as stored/returned by the API — distinct from the URL-safe slug used in public routes. */
export type LegalDocumentPlacementSlugUpper = "ACCOUNT_REGISTRATION" | "TICKET_CHECKOUT";

export type LegalDocument = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  territory: string;
  current_version_id: number | null;
  current_version: LegalDocumentVersion | null;
  versions?: LegalDocumentVersion[];
  placements?: LegalDocumentPlacement[];
  created_at: string;
  updated_at: string;
};

async function request<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "PUT"; body?: unknown } = {},
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

export function listLegalDocuments() {
  return request<{ documents: LegalDocument[] }>("/api/admin/platform-documents");
}

export function createLegalDocument(input: { name: string; description?: string | null }) {
  return request<{ document: LegalDocument }>("/api/admin/platform-documents", { method: "POST", body: input });
}

export function getLegalDocument(slug: string) {
  return request<{ document: LegalDocument }>(`/api/admin/platform-documents/${slug}`);
}

export function createLegalDocumentVersion(slug: string, richTextContent: string) {
  return request<{ version: LegalDocumentVersion }>(`/api/admin/platform-documents/${slug}/versions`, {
    method: "POST",
    body: { rich_text_content: richTextContent },
  });
}

export function createPdfLegalDocumentVersion(slug: string, file: File) {
  const formData = new FormData();
  formData.append("document", file);
  return upload<{ version: LegalDocumentVersion }>(`/api/admin/platform-documents/${slug}/versions/pdf`, formData);
}

export function updateLegalDocumentVersion(slug: string, versionId: number, richTextContent: string) {
  return request<{ version: LegalDocumentVersion }>(`/api/admin/platform-documents/${slug}/versions/${versionId}`, {
    method: "PATCH",
    body: { rich_text_content: richTextContent },
  });
}

export function publishLegalDocumentVersion(slug: string, versionId: number) {
  return request<{ version: LegalDocumentVersion }>(`/api/admin/platform-documents/${slug}/versions/${versionId}/publish`, {
    method: "PATCH",
  });
}

export function updateLegalDocumentPlacements(slug: string, placements: { placement: LegalDocumentPlacementSlugUpper; sort_order: number }[]) {
  return request<{ placements: LegalDocumentPlacement[] }>(`/api/admin/platform-documents/${slug}/placements`, {
    method: "PUT",
    body: { placements },
  });
}
