import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import { getAdminAuthState } from "@/lib/adminSession";
import type { AdminOrganization } from "@/lib/platformOrganizationApi";
import { OrganizationDetail } from "@/components/OrganizationDetail";

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;

  const [result, state] = await Promise.all([
    backendRequest<{ organization: AdminOrganization }>(`/api/admin/organizations/${organizationId}`),
    getAdminAuthState(),
  ]);

  if (result.status === 404) {
    notFound();
  }

  const permissions = state.status === "privileged" ? state.permissions : [];

  return <OrganizationDetail initialOrganization={result.data.organization} permissions={permissions} />;
}
