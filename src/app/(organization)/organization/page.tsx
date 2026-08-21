import { notFound, redirect } from "next/navigation";
import { Stack } from "@mantine/core";
import { APP_URL, backendRequest } from "@/lib/backend";
import { getCurrentUser } from "@/lib/session";
import type { Organization } from "@/lib/organizationApi";
import { OrganizationSettingsForm } from "@/components/OrganizationSettingsForm";

export default async function OrganizationPage() {
  const [result, user] = await Promise.all([
    backendRequest<{ organization: Organization | null }>("/api/organization"),
    getCurrentUser(),
  ]);

  if (result.status !== 200 || !user) {
    notFound();
  }

  const organization = result.data.organization;

  // A user with no organization membership (e.g. a platform SUPERADMIN,
  // who isn't required to belong to one) has nothing to show here — the
  // admin layout only guards auth/verification, not org membership, so
  // this page must handle that gap itself rather than crash on a null
  // organization.
  if (!organization) {
    redirect("/dashboard");
  }

  return (
    <Stack gap="xl" maw={640}>
      <OrganizationSettingsForm initialOrganization={organization} canEdit={user.role === "ADMIN"} appUrl={APP_URL} />
    </Stack>
  );
}
