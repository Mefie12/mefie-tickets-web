export type FeaturedAdminEvent = { id: number; title: string; start_date: string | null; status: string; organization: { name: string } };
export type FeaturedPlacement = { id: number; position: number; eligible: boolean; ineligible_reason: string | null; event: FeaturedAdminEvent };
async function request<T>(url: string, options?: RequestInit): Promise<T> { const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message ?? Object.values(data.errors ?? {}).flat()[0] ?? "Request failed"); return data; }
export const listFeatured = () => request<{ placements: FeaturedPlacement[] }>("/api/admin/featured-events");
export const searchFeaturedCandidates = (q: string) => request<{ events: FeaturedAdminEvent[] }>(`/api/admin/featured-events/candidates?q=${encodeURIComponent(q)}`);
export const addFeatured = (eventId: number) => request("/api/admin/featured-events", { method: "POST", body: JSON.stringify({ event_id: eventId }) });
export const removeFeatured = (placementId: number) => request(`/api/admin/featured-events/${placementId}`, { method: "DELETE" });
export const reorderFeatured = (eventIds: number[]) => request("/api/admin/featured-events/order", { method: "PUT", body: JSON.stringify({ event_ids: eventIds }) });
