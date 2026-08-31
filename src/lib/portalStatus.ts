import type { EntitlementAssignmentStatus } from "@/lib/portalApi";

/** Badge colour + human label per entitlement assignment status. */
export const ASSIGNMENT_STATUS_META: Record<
  EntitlementAssignmentStatus,
  { label: string; color: string }
> = {
  BUYER_HELD: { label: "Unassigned", color: "orange" },
  PENDING_ACCEPTANCE: { label: "Awaiting acceptance", color: "yellow" },
  ISSUED: { label: "Ready", color: "teal" },
  CHECKED_IN: { label: "Checked in", color: "blue" },
  REFUNDED: { label: "Refunded", color: "gray" },
  VOIDED: { label: "Void", color: "gray" },
  SUSPENDED: { label: "On hold", color: "red" },
};

export function assignmentStatusMeta(status: EntitlementAssignmentStatus) {
  return ASSIGNMENT_STATUS_META[status] ?? { label: status, color: "gray" };
}

export function ticketLabel(ticket: { name: string | null; option: string | null }): string {
  if (!ticket.name) return "Ticket";
  return ticket.option ? `${ticket.name} — ${ticket.option}` : ticket.name;
}
