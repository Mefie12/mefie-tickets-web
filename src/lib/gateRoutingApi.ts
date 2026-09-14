import { ApiError } from "@/lib/authApi";

export type GateLane = { id: number; event_gate_id: number; name: string; code: string; status: string };
export type EventGate = {
  id: number;
  public_id: string;
  event_id: number;
  name: string;
  is_default: boolean;
  status: string;
  lanes: GateLane[];
};
export type RoutingGenerationRoute = { id: number; product_id: number; event_gate_id: number; gate_lane_id: number };
export type RoutingGeneration = {
  id: number;
  public_id: string;
  version: number;
  status: "DRAFT" | "ACTIVE" | "SUPERSEDED";
  published_at: string | null;
  routes: RoutingGenerationRoute[];
};
export type GateConfiguration = {
  gates: EventGate[];
  generation: RoutingGeneration;
  structure_changes: { allowed: boolean; reason: string | null };
  publication?: RoutingChangePublication | null;
};
export type RoutingChangePublication = {
  id: string;
  status: "PREPARING" | "READY" | "FAILED" | "PUBLISHED" | "CANCELLED";
  affected_credentials: number;
  prepared_credentials: number;
  failed_credentials: number;
  failure_message: string | null;
  published_at: string | null;
  generation: RoutingGeneration;
};

async function request<T>(path: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.message ?? "Something went wrong.", response.status, data?.errors);
  return data as T;
}

export const createGate = (eventId: number, name: string) =>
  request<{ gate: EventGate }>(`/api/events/${eventId}/gates`, "POST", { name });

export const createLane = (eventId: number, gateId: number, name: string, code: string) =>
  request<{ lane: GateLane }>(`/api/events/${eventId}/gates/${gateId}/lanes`, "POST", { name, code });

export const replaceGateRoutes = (eventId: number, routes: { product_id: number; event_gate_id: number; gate_lane_id?: number }[]) =>
  request<{ generation: RoutingGeneration }>(`/api/events/${eventId}/gate-routing`, "PUT", { routes });

export const prepareRoutingChange = (eventId: number, routes: { product_id: number; event_gate_id: number; gate_lane_id: number }[]) =>
  request<{ publication: RoutingChangePublication }>(`/api/events/${eventId}/gate-routing/publications`, "POST", { routes });

export async function getRoutingChange(eventId: number, publicationId: string): Promise<{ publication: RoutingChangePublication }> {
  const response = await fetch(`/api/events/${eventId}/gate-routing/publications/${encodeURIComponent(publicationId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data?.message ?? "Something went wrong.", response.status, data?.errors);
  return data;
}

export const retryRoutingChange = (eventId: number, publicationId: string) =>
  request<{ publication: RoutingChangePublication }>(`/api/events/${eventId}/gate-routing/publications/${encodeURIComponent(publicationId)}/retry`, "POST", {});

export const publishRoutingChange = (eventId: number, publicationId: string) =>
  request<{ publication: RoutingChangePublication }>(`/api/events/${eventId}/gate-routing/publications/${encodeURIComponent(publicationId)}/publish`, "POST", { confirmed: true });

export const cancelRoutingChange = (eventId: number, publicationId: string) =>
  request<{ publication: RoutingChangePublication }>(`/api/events/${eventId}/gate-routing/publications/${encodeURIComponent(publicationId)}/cancel`, "POST", { confirmed: true });
