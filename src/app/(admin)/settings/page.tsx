import { getCurrentUser } from "@/lib/session";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  // Deduped with the (admin) layout's own getCurrentUser() call within
  // the same request — the layout already guarantees this is non-null.
  const user = await getCurrentUser();

  return <SettingsForm initialUser={user!} />;
}
