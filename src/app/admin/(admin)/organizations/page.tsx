import { backendRequest } from "@/lib/backend";
import type { AdminOrganization, PageMeta } from "@/lib/platformOrganizationApi";
import { OrganizationsTable } from "@/components/OrganizationsTable";

export default async function AdminOrganizationsPage() {
  const result = await backendRequest<{ organizations: AdminOrganization[]; meta: PageMeta }>(
    "/api/admin/organizations",
  );

  return (
    <OrganizationsTable
      initialOrganizations={result.status === 200 ? result.data.organizations : []}
      initialMeta={result.status === 200 ? result.data.meta : { current_page: 1, last_page: 1, total: 0 }}
    />
  );
}
