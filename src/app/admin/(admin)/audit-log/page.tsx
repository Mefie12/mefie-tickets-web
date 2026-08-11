import { Stack, Title } from "@mantine/core";
import { AuditLogFeed } from "@/components/AuditLogFeed";

export default function AdminAuditLogPage() {
  return (
    <Stack gap="xl" maw={880}>
      <Title order={2} fz={28}>
        Audit Log
      </Title>
      <AuditLogFeed />
    </Stack>
  );
}
