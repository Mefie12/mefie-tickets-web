import { ApiError } from "@/lib/authApi";
import type { PublicBundle, PublicProduct } from "@/lib/publicEventApi";
import type { LayoutNode } from "@/lib/ticketLayout";
import { toPayload } from "@/lib/ticketLayout";

/** What a buyer would see right now (server-built by the same code as the public page). */
export type BuyerView = { products: PublicProduct[]; bundles: PublicBundle[]; ticket_layout: LayoutNode[] };

export type TicketLayoutResponse = {
  /** Hash of the structure: send it back with a write so a stale editor is told instead of overwriting. */
  revision: string;
  nodes: LayoutNode[];
  buyer_view: BuyerView;
  /** Only on a create. */
  section_id?: number;
};

/** The 409 the server sends when the list changed under the editor; carries the fresh layout. */
export class LayoutConflictError extends Error {
  constructor(message: string, readonly layout: Pick<TicketLayoutResponse, "revision" | "nodes"> | null) {
    super(message);
  }
}

async function call<T>(path: string, method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409 && data?.code === "LAYOUT_CHANGED") throw new LayoutConflictError(data.message, data.layout ?? null);
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }
  return data as T;
}

export const getTicketLayout = (eventId: number) => call<TicketLayoutResponse>(`/api/events/${eventId}/ticket-layout`, "GET");

export const saveTicketLayout = (eventId: number, revision: string, nodes: LayoutNode[]) =>
  call<TicketLayoutResponse>(`/api/events/${eventId}/ticket-layout`, "PUT", { revision, nodes: toPayload(nodes) });

export type SectionInput = { title?: string; description?: string | null; collapsed_by_default?: boolean };

export const createTicketSection = (eventId: number, input: SectionInput & { title: string }) =>
  call<TicketLayoutResponse>(`/api/events/${eventId}/ticket-sections`, "POST", input);

export const updateTicketSection = (eventId: number, sectionId: number, input: SectionInput) =>
  call<TicketLayoutResponse>(`/api/events/${eventId}/ticket-sections/${sectionId}`, "PATCH", input);

export const deleteTicketSection = (eventId: number, sectionId: number, revision: string) =>
  call<TicketLayoutResponse>(`/api/events/${eventId}/ticket-sections/${sectionId}`, "DELETE", { revision });

export const applyTicketLayoutToOccurrences = (seriesId: number) =>
  call<{ applied: number }>(`/api/event-series/${seriesId}/apply-ticket-layout`, "POST");
