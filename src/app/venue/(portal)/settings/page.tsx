import { getCurrentUser } from "@/lib/session";
import { SettingsForm } from "@/components/SettingsForm";

export default async function VenueSettingsPage() {
  // Deduped with the (portal) layout's own getCurrentUser() call within the same request.
  const user = await getCurrentUser();

  return <SettingsForm initialUser={user!} />;
}
