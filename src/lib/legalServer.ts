import { backendRequest } from "@/lib/backend";
import type { PublicLegalDocument } from "@/lib/legalDocumentsApi";

/** Server-side read of the documents listed in the public footer. Never throws: a legal-link failure must not break a page. */
export async function getFooterLegalDocuments(): Promise<PublicLegalDocument[]> {
  try {
    const result = await backendRequest<PublicLegalDocument[]>("/api/public/legal-documents/placements/public-footer", { timeoutMs: 2500 });
    return result.ok && Array.isArray(result.data) ? result.data : [];
  } catch {
    return [];
  }
}

export async function getPublishedLegalDocument(slug: string): Promise<PublicLegalDocument | null> {
  try {
    const result = await backendRequest<PublicLegalDocument>(`/api/public/legal-documents/${encodeURIComponent(slug)}`);
    return result.status === 200 ? result.data : null;
  } catch {
    return null;
  }
}
