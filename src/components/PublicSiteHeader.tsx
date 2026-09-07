import { getCurrentUser, getCurrentOrganization } from "@/lib/session";
import { getConsumerSession } from "@/lib/consumerSession";
import { PublicSiteNav } from "@/components/PublicSiteNav";

export async function PublicSiteHeader() {
  const [user, consumer] = await Promise.all([getCurrentUser(), getConsumerSession()]);
  // Only logged-in organizers with an org need branding; distributor-only
  // accounts (current_organization_id === null) and anonymous visitors don't.
  const organization = user?.current_organization_id ? await getCurrentOrganization() : null;

  return (
    <PublicSiteNav
      user={
        user
          ? {
              firstName: user.first_name,
              lastName: user.last_name,
              hasOrganization: user.current_organization_id !== null,
              organization: organization
                ? { name: organization.name, slug: organization.slug, logoUrl: organization.logo_url }
                : null,
            }
          : null
      }
      consumer={consumer?.profile ?? null}
    />
  );
}
