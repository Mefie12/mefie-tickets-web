import { getCurrentUser } from "@/lib/session";
import { PublicSiteNav } from "@/components/PublicSiteNav";

export async function PublicSiteHeader() {
  const user = await getCurrentUser();
  return <PublicSiteNav user={user ? { firstName: user.first_name, lastName: user.last_name, hasOrganization: user.current_organization_id !== null } : null} />;
}
