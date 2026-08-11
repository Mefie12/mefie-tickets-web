import { backendRequest } from "@/lib/backend";
import type { PageMeta } from "@/lib/platformOrganizationApi";
import type { AdminUser } from "@/lib/platformUserApi";
import { UsersTable } from "@/components/UsersTable";

export default async function AdminUsersPage() {
  const result = await backendRequest<{ users: AdminUser[]; meta: PageMeta }>("/api/admin/users");

  return (
    <UsersTable
      initialUsers={result.status === 200 ? result.data.users : []}
      initialMeta={result.status === 200 ? result.data.meta : { current_page: 1, last_page: 1, total: 0 }}
    />
  );
}
