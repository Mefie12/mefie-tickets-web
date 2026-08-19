import { ApiError } from "@/lib/authApi";

export type AdminTaxonomyItem = {
  id: number; name: string; slug: string; description: string | null; sort_order: number;
  is_active: boolean; archived_at: string | null; merged_into_id: number | null;
  merged_into?: { id: number; name: string; slug: string } | null;
  current_event_count: number; ever_used_event_count: number;
};
export type AdminCategory = AdminTaxonomyItem & { subcategories: AdminTaxonomyItem[]; active_children_count: number };

async function request<T>(path: string, options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}) {
  const response = await fetch(path, { method: options.method ?? "GET", headers: { "Content-Type": "application/json" }, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.message ?? "Taxonomy request failed.", response.status, data?.errors, data?.code);
  return data as T;
}

export const listAdminTaxonomy = (archived = false) => request<{ categories: AdminCategory[] }>(`/api/admin/event-taxonomy?archived=${archived ? 1 : 0}`);
export const createAdminCategory = (body: { name: string; description?: string; sort_order?: number }) => request("/api/admin/event-taxonomy/categories", { method: "POST", body });
export const createAdminSubcategories = (categoryId: number, items: { name: string }[]) => request(`/api/admin/event-taxonomy/categories/${categoryId}/subcategories`, { method: "POST", body: { items } });
export const updateAdminTaxonomy = (type: string, id: number, body: { name: string; description?: string | null; sort_order?: number }) => request(`/api/admin/event-taxonomy/${type}/${id}`, { method: "PATCH", body });
export const taxonomyImpact = (type: string, id: number) => request<{ impact: { current_events: number; eligible_events: number; historical_events: number; can_delete: boolean } }>(`/api/admin/event-taxonomy/${type}/${id}/impact`);
export const archiveTaxonomy = (type: string, id: number, body: { operation_key: string; reason: string; scope: "NONE" | "ELIGIBLE"; target_id?: number; mappings?: Record<string, number> }) => request(`/api/admin/event-taxonomy/${type}/${id}/archive`, { method: "POST", body });
export const mergeTaxonomy = (type: string, id: number, body: { operation_key: string; reason: string; scope: "NONE" | "ELIGIBLE"; target_id: number; mappings?: Record<string, number> }) => request(`/api/admin/event-taxonomy/${type}/${id}/merge`, { method: "POST", body });
export const restoreTaxonomy = (type: string, id: number) => request(`/api/admin/event-taxonomy/${type}/${id}/restore`, { method: "POST", body: { operation_key: crypto.randomUUID() } });
export const deleteTaxonomy = (type: string, id: number) => request(`/api/admin/event-taxonomy/${type}/${id}`, { method: "DELETE", body: { operation_key: crypto.randomUUID() } });
