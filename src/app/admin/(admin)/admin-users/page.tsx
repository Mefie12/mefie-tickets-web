import { Alert, Container } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import { getAdminAuthState } from "@/lib/adminSession";
import type { AdminUserRow } from "@/lib/platformAdminUsersApi";
import { AdminStaffTable } from "@/components/AdminStaffTable";

export default async function AdminStaffPage() {
  const state = await getAdminAuthState();
  const permissions = state.status === "privileged" ? state.permissions : [];

  if (!permissions.includes("admin_users.view")) {
    return (
      <Container size="xs" py={80}>
        <Alert color="red" title="Not authorized">
          Only Super Admins can manage Admin Console staff.
        </Alert>
      </Container>
    );
  }

  const result = await backendRequest<{ admin_users: AdminUserRow[] }>("/api/admin/admin-users");

  return <AdminStaffTable initialRows={result.status === 200 ? result.data.admin_users : []} />;
}
