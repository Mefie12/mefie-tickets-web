import { getCurrentUser } from "@/lib/session";
import { getConsumerSession } from "@/lib/consumerSession";
import { PublicSiteNav } from "@/components/PublicSiteNav";
export async function PublicSiteHeader() {
  const [user, consumer] = await Promise.all([getCurrentUser(), getConsumerSession()]);
  return <PublicSiteNav user={user ? { firstName: user.first_name, lastName: user.last_name, hasOrganization: user.current_organization_id !== null } : null} consumer={consumer?.profile ?? null}/>;
}
