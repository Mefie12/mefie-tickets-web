import { ApiError } from "@/lib/authApi";
import type { Event } from "@/lib/eventApi";

async function request<T>(
  path: string,
  options: { method?: "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: options.method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

async function upload(path: string, formData: FormData): Promise<{ event: Event }> {
  const res = await fetch(path, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Upload failed.", res.status, data?.errors, data?.code);
  }

  return data as { event: Event };
}

export function uploadEventCoverImage(eventId: number, file: File) {
  const formData = new FormData();
  formData.append("cover_image", file);
  return upload(`/api/events/${eventId}/media/cover`, formData);
}

export function deleteEventCoverImage(eventId: number) {
  return request<{ message: string }>(`/api/events/${eventId}/media/cover`, { method: "DELETE" });
}

export function uploadEventGalleryImage(eventId: number, file: File, altText?: string) {
  const formData = new FormData();
  formData.append("image", file);
  if (altText) formData.append("alt_text", altText);
  return upload(`/api/events/${eventId}/media/gallery`, formData);
}

export function deleteEventGalleryImage(eventId: number, mediaId: number) {
  return request<{ event: Event }>(`/api/events/${eventId}/media/gallery/${mediaId}`, { method: "DELETE" });
}

export function updateEventGalleryImageAltText(eventId: number, mediaId: number, altText: string | null) {
  return request<{ event: Event }>(`/api/events/${eventId}/media/gallery/${mediaId}`, {
    method: "PATCH",
    body: { alt_text: altText },
  });
}

export function reorderEventGallery(eventId: number, orderedMediaIds: number[]) {
  return request<{ event: Event }>(`/api/events/${eventId}/media/gallery/reorder`, {
    method: "PATCH",
    body: { media_ids: orderedMediaIds },
  });
}
