import { ApiError } from "@/lib/authApi";

export type PlatformDocumentTypeSlug = "terms-of-use" | "privacy-policy";

export type PublicPlatformDocument = {
  type: PlatformDocumentTypeSlug;
  content_type: "RICH_TEXT" | "PDF";
  rich_text_content: string | null;
  published_at: string | null;
};

/** Public, unauthenticated read of the current published Terms of Use / Privacy Policy. */
export async function getPublicPlatformDocument(type: PlatformDocumentTypeSlug): Promise<PublicPlatformDocument | null> {
  const res = await fetch(`/api/public/platform-documents/${type}`, { cache: "no-store" });
  if (res.status === 404) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Could not load document.", res.status);
  return data as PublicPlatformDocument;
}
