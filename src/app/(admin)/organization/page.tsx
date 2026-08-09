import { notFound } from "next/navigation";
import { Stack } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import { getCurrentUser } from "@/lib/session";
import type { Organization } from "@/lib/organizationApi";
import type { OrganizerPayoutSummary } from "@/lib/organizerPayoutApi";
import { OrganizationSettingsForm } from "@/components/OrganizationSettingsForm";
import { OrganizationPayoutCard } from "@/components/OrganizationPayoutCard";

export default async function OrganizationPage() {
  const [result, user] = await Promise.all([
    backendRequest<{ organization: Organization }>("/api/organization"),
    getCurrentUser(),
  ]);

  if (result.status !== 200 || !user) {
    notFound();
  }

  const organization = result.data.organization;

  const payoutsResult = await backendRequest<OrganizerPayoutSummary>(
    `/api/organizations/${organization.id}/payouts`,
  );

  return (
    <Stack gap="xl" maw={640}>
      <OrganizationSettingsForm initialOrganization={organization} canEdit={user.role === "ADMIN"} />
      {payoutsResult.status === 200 && <OrganizationPayoutCard summary={payoutsResult.data} />}
    </Stack>
  );
}
