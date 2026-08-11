import { Stack, Title } from "@mantine/core";
import { getAdminAuthState } from "@/lib/adminSession";
import { AdminDashboardTiles } from "@/components/AdminDashboardTiles";

export default async function AdminDashboardPage() {
  const state = await getAdminAuthState();
  const permissions = state.status === "privileged" ? state.permissions : [];

  return (
    <Stack gap="xl" maw={960}>
      <Title order={2} fz={28}>
        Dashboard
      </Title>

      <AdminDashboardTiles permissions={permissions} />
    </Stack>
  );
}
