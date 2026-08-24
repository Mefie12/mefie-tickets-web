import { ApiError } from "@/lib/authApi";
import type { SocialLink, TalentRole } from "@/lib/talentApi";

export type ContentSectionType = "LINEUP" | "CUSTOM";

export type LineupItem = {
  id: number;
  content_section_id: number;
  template_item_id: number | null;
  talent_profile_id: number;
  talent_profile_version_id: number;
  role_override: string | null;
  description: string | null;
  is_featured: boolean;
  sort_order: number;
  /** Cosmetic display label only (e.g. "12:00 AM - 1:00 AM") — not a real scheduling field. */
  set_time_label: string | null;
  overridden_fields: string[] | null;
  talent_profile?: { id: number; status: "ACTIVE" | "ARCHIVED" };
  talent_profile_version?: {
    display_name: string;
    role: TalentRole;
    tagline: string | null;
    profile_image_url: string | null;
    social_links: SocialLink[] | null;
  };
};

export type CustomSectionCard = {
  id: number;
  content_section_id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  sort_order: number;
};

export type ContentSection = {
  id: number;
  event_id: number;
  template_section_id: number | null;
  type: ContentSectionType;
  title: string;
  intro: string | null;
  sort_order: number;
  is_visible: boolean;
  overridden_fields: string[] | null;
  lineup_items?: LineupItem[];
  custom_cards?: CustomSectionCard[];
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
  if (!res.ok) throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  return data as T;
}

export function listContentSections(eventId: number) {
  return request<{ content_sections: ContentSection[] }>(`/api/events/${eventId}/content-sections`);
}

export function createContentSection(eventId: number, input: { type: ContentSectionType; title: string; intro?: string | null; sort_order?: number }) {
  return request<{ content_section: ContentSection }>(`/api/events/${eventId}/content-sections`, { method: "POST", body: input });
}

export function updateContentSection(eventId: number, sectionId: number, input: Partial<{ title: string; intro: string | null; is_visible: boolean }>) {
  return request<{ content_section: ContentSection }>(`/api/events/${eventId}/content-sections/${sectionId}`, { method: "PATCH", body: input });
}

export function deleteContentSection(eventId: number, sectionId: number) {
  return request<{ message: string }>(`/api/events/${eventId}/content-sections/${sectionId}`, { method: "DELETE" });
}

export function reorderContentSections(eventId: number, sectionIds: number[]) {
  return request<{ reordered: true }>(`/api/events/${eventId}/content-sections/reorder`, { method: "PATCH", body: { section_ids: sectionIds } });
}

export function createLineupItem(eventId: number, sectionId: number, input: { talent_profile_id: number; role_override?: string | null; description?: string | null; is_featured?: boolean; sort_order?: number; set_time_label?: string | null }) {
  return request<{ lineup_item: LineupItem }>(`/api/events/${eventId}/content-sections/${sectionId}/lineup-items`, { method: "POST", body: input });
}

export function updateLineupItem(
  eventId: number,
  sectionId: number,
  itemId: number,
  input: Partial<{ role_override: string | null; description: string | null; is_featured: boolean; sort_order: number; set_time_label: string | null; sync_to_latest: boolean }>,
) {
  return request<{ lineup_item: LineupItem }>(`/api/events/${eventId}/content-sections/${sectionId}/lineup-items/${itemId}`, { method: "PATCH", body: input });
}

export function deleteLineupItem(eventId: number, sectionId: number, itemId: number) {
  return request<{ message: string }>(`/api/events/${eventId}/content-sections/${sectionId}/lineup-items/${itemId}`, { method: "DELETE" });
}

export function reorderLineupItems(eventId: number, sectionId: number, itemIds: number[]) {
  return request<{ reordered: true }>(`/api/events/${eventId}/content-sections/${sectionId}/lineup-items/reorder`, { method: "PATCH", body: { item_ids: itemIds } });
}

export function createCustomCard(eventId: number, sectionId: number, input: { title: string; description?: string | null; link_url?: string | null; link_label?: string | null; sort_order?: number }) {
  return request<{ custom_section_card: CustomSectionCard }>(`/api/events/${eventId}/content-sections/${sectionId}/custom-cards`, { method: "POST", body: input });
}

export function updateCustomCard(
  eventId: number,
  sectionId: number,
  cardId: number,
  input: Partial<{ title: string; description: string | null; link_url: string | null; link_label: string | null; sort_order: number }>,
) {
  return request<{ custom_section_card: CustomSectionCard }>(`/api/events/${eventId}/content-sections/${sectionId}/custom-cards/${cardId}`, { method: "PATCH", body: input });
}

export function deleteCustomCard(eventId: number, sectionId: number, cardId: number) {
  return request<{ message: string }>(`/api/events/${eventId}/content-sections/${sectionId}/custom-cards/${cardId}`, { method: "DELETE" });
}

export function reorderCustomCards(eventId: number, sectionId: number, cardIds: number[]) {
  return request<{ reordered: true }>(`/api/events/${eventId}/content-sections/${sectionId}/custom-cards/reorder`, { method: "PATCH", body: { card_ids: cardIds } });
}

export async function uploadCustomCardImage(eventId: number, sectionId: number, cardId: number, file: File) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(`/api/events/${eventId}/content-sections/${sectionId}/custom-cards/${cardId}/image`, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.message ?? "Upload failed.", res.status, data?.errors, data?.code);
  return data as { custom_section_card: CustomSectionCard };
}
