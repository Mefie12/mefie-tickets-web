export type FeaturedTargetType = "event" | "series";
export type FeaturedAdminTarget = { id: number; title: string; start_date: string | null; status: string; organization: { name: string } };
/** A candidate row from the picker — the only shape carrying its own `type` alongside the target fields. */
export type FeaturedCandidate = FeaturedAdminTarget & { type: FeaturedTargetType };
export type FeaturedPlacement = { id: number; position: number; eligible: boolean; ineligible_reason: string | null; type: FeaturedTargetType; target: FeaturedAdminTarget };
async function request<T>(url: string, options?: RequestInit): Promise<T> { const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message ?? Object.values(data.errors ?? {}).flat()[0] ?? "Request failed"); return data; }
export const listFeatured = () => request<{ placements: FeaturedPlacement[] }>("/api/admin/featured-events");
export const searchFeaturedCandidates = (q: string) => request<{ candidates: FeaturedCandidate[] }>(`/api/admin/featured-events/candidates?q=${encodeURIComponent(q)}`);
/** §7.1 — a candidate is either a standalone event or a recurring series; exactly one of the two ids is sent. */
export const addFeatured = (candidate: { type: FeaturedTargetType; id: number }) =>
  request("/api/admin/featured-events", {
    method: "POST",
    body: JSON.stringify(candidate.type === "series" ? { event_series_id: candidate.id } : { event_id: candidate.id }),
  });
export const removeFeatured = (placementId: number) => request(`/api/admin/featured-events/${placementId}`, { method: "DELETE" });
export const reorderFeatured = (placementIds: number[]) => request("/api/admin/featured-events/order", { method: "PUT", body: JSON.stringify({ placement_ids: placementIds }) });
