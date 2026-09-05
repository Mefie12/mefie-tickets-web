import { ApiError } from "@/lib/authApi";
import type { PlatformDocumentTypeSlug } from "@/lib/platformDocumentsApi";

export type TermsContentType = "RICH_TEXT" | "PDF";
export type TermsVersionStatus = "DRAFT" | "PUBLISHED";

export type PlatformDocumentVersion = {
  id: number;
  platform_document_id: number;
  version_number: number;
  content_type: TermsContentType;
  rich_text_content: string | null;
  status: TermsVersionStatus;
  published_at: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type PlatformDocument = {
  id: number;
  type: "TERMS_OF_USE" | "PRIVACY_POLICY";
  territory: string;
  current_version_id: number | null;
  current_version: PlatformDocumentVersion | null;
  versions?: PlatformDocumentVersion[];
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

export function getPlatformDocument(type: PlatformDocumentTypeSlug) {
  return request<{ document: PlatformDocument }>(`/api/admin/platform-documents/${type}`);
}

export function createPlatformDocumentVersion(type: PlatformDocumentTypeSlug, richTextContent: string) {
  return request<{ version: PlatformDocumentVersion }>(`/api/admin/platform-documents/${type}/versions`, {
    method: "POST",
    body: { rich_text_content: richTextContent },
  });
}

export function createPdfPlatformDocumentVersion(type: PlatformDocumentTypeSlug, file: File) {
  const formData = new FormData();
  formData.append("document", file);
  return upload<{ version: PlatformDocumentVersion }>(`/api/admin/platform-documents/${type}/versions/pdf`, formData);
}

export function updatePlatformDocumentVersion(type: PlatformDocumentTypeSlug, versionId: number, richTextContent: string) {
  return request<{ version: PlatformDocumentVersion }>(`/api/admin/platform-documents/${type}/versions/${versionId}`, {
    method: "PATCH",
    body: { rich_text_content: richTextContent },
  });
}

export function publishPlatformDocumentVersion(type: PlatformDocumentTypeSlug, versionId: number) {
  return request<{ version: PlatformDocumentVersion }>(`/api/admin/platform-documents/${type}/versions/${versionId}/publish`, {
    method: "PATCH",
  });
}
