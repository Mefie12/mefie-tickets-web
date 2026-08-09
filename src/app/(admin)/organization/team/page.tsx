import { backendRequest } from "@/lib/backend";
import { getCurrentUser } from "@/lib/session";
import type { TeamRow } from "@/lib/teamApi";
import { TeamMembersTable } from "@/components/TeamMembersTable";

export default async function TeamPage() {
  const [result, user] = await Promise.all([
    backendRequest<{ members: TeamRow[] }>("/api/organization/members"),
    getCurrentUser(),
  ]);

  const rows = result.status === 200 ? result.data.members : [];

  return <TeamMembersTable initialRows={rows} canEdit={user?.role === "ADMIN"} />;
}
