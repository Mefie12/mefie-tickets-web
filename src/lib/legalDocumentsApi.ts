import { ApiError } from "@/lib/authApi";

export type LegalDocumentPlacementSlug = "account-registration" | "ticket-checkout";

export type PublicLegalDocument = {
  version_id: number;
  name: string;
  slug: string;
  content_type: "RICH_TEXT" | "PDF";
  rich_text_content: string | null;
  published_at: string | null;
};

/** Public, unauthenticated read of a single document's current published content, by slug. */
export async function getPublicLegalDocument(slug: string): Promise<PublicLegalDocument | null> {
  const res = await fetch(`/api/public/legal-documents/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Could not load document.", res.status);
  return data as PublicLegalDocument;
}

/** Public, unauthenticated read of every published document attached to a placement — the frontend never needs to know document names or IDs ahead of time. */
export async function getLegalDocumentsForPlacement(placement: LegalDocumentPlacementSlug): Promise<PublicLegalDocument[]> {
  const res = await fetch(`/api/public/legal-documents/placements/${placement}`, { cache: "no-store" });
  const data = await res.json().catch(() => ([]));
  if (!res.ok) throw new ApiError(data?.message ?? "Could not load documents.", res.status);
  return data as PublicLegalDocument[];
}
