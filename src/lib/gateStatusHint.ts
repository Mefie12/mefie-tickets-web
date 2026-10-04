export type RoutingChanges = { allowed: boolean; reasons: string[] };

/**
 * Why an entrance or lane still shows "Not published". Null once it is live.
 * What unblocks it depends on the event: a draft event publishes everything
 * with the event itself, a live event needs a routed + published change.
 */
export function gateStatusHint({ kind, status, eventStatus }: {
  kind: "entrance" | "lane";
  status: string;
  eventStatus: string;
}): string | null {
  if (status !== "CONFIGURING") return null;
  if (eventStatus === "DRAFT") {
    return `Not published yet. This ${kind} goes live when the event is published.`;
  }
  if (eventStatus === "LIVE") {
    return kind === "lane"
      ? "Not live yet. Route a ticket type to this lane and publish the routing change to activate it."
      : "Not live yet. Route a ticket type to one of its lanes and publish the routing change to activate it.";
  }
  return `Not live. Routing changes are only available for live events.`;
}

/**
 * Reasons a published routing change can't be prepared right now. A draft
 * event edits routing directly (no publication), so nothing blocks it there.
 */
export function routingBlockReasons({ structureEditable, routingChanges }: {
  structureEditable: boolean;
  routingChanges: RoutingChanges | undefined;
}): string[] {
  if (structureEditable || !routingChanges || routingChanges.allowed) return [];
  return routingChanges.reasons;
}

/** Every message to surface for a failed request: all `routing` errors when the API sent several, else the single message. */
export function routingErrorMessages(error: unknown, fallback: string): string[] {
  const routing = (error as { errors?: Record<string, string[]> } | null)?.errors?.routing;
  if (Array.isArray(routing) && routing.length > 0) return routing;
  return [error instanceof Error ? error.message : fallback];
}
