import { ApiError, type Role } from "@/lib/authApi";

/**
 * Role options a caller can invite/assign today. Only ORGANIZER is
 * accepted by the backend's allow-list right now (see
 * CreateInvitationData#[In(['ORGANIZER'])]) — kept as an actual array so
 * loosening that allow-list later is a one-line change here, not a
 * rewrite of the picker.
 */
export const INVITABLE_ROLES: { value: Role; label: string }[] = [{ value: "ORGANIZER", label: "Organizer" }];

/**
 * Roles an existing membership can be changed to (see
 * UpdateTeamMemberRoleAction's `Rule::in`) — wider than INVITABLE_ROLES
 * above, since promoting an existing teammate to ADMIN is allowed even
 * though inviting someone in as ADMIN directly isn't (yet).
 */
export const ASSIGNABLE_ROLES: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "ORGANIZER", label: "Organizer" },
];

export type MembershipStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REMOVED";
export type InvitationStatus = "PENDING" | "EXPIRED";

export type TeamMemberRow = {
  type: "member";
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: MembershipStatus;
  date_added: string;
};

export type TeamInvitationRow = {
  type: "invitation";
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: InvitationStatus;
  date_added: string;
};

export type TeamRow = TeamMemberRow | TeamInvitationRow;

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

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong.", res.status, data?.errors, data?.code);
  }

  return data as T;
}

export function getTeamMembers() {
  return request<{ members: TeamRow[] }>("/api/organization/members");
}

export function inviteTeammate(input: {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: string;
}) {
  return request<{
    invitation: { id: number; email: string; first_name: string; last_name: string; phone: string | null; role: Role; expires_at: string };
  }>("/api/organization/invitations", { method: "POST", body: input });
}

export function cancelInvitation(id: number) {
  return request<{ cancelled: true }>(`/api/organization/invitations/${id}`, { method: "DELETE" });
}

export function removeTeamMember(membershipId: number) {
  return request<{ removed: true }>(`/api/organization/members/${membershipId}`, { method: "DELETE" });
}

export function updateTeamMemberRole(membershipId: number, role: string) {
  return request<{ membership: unknown }>(`/api/organization/members/${membershipId}`, {
    method: "PATCH",
    body: { role },
  });
}
