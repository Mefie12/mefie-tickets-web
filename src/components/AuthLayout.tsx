import { Container, Group, Paper, Stack, Text } from "@mantine/core";
import { IconTicket } from "@tabler/icons-react";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Container size="xs" py={80}>
      <Stack gap="xl">
        <Group gap="xs" justify="center">
          <IconTicket size={22} />
          <Text size="sm" c="dimmed" fw={500}>
            Mefie Tickets
          </Text>
        </Group>

        <Stack gap={4} align="center">
          <Text component="h1" fz={28} fw={800} ta="center">
            {title}
          </Text>
          {subtitle && (
            <Text c="dimmed" size="sm" ta="center" maw={380}>
              {subtitle}
            </Text>
          )}
        </Stack>

        <Paper withBorder radius="lg" shadow="md" p="xl">
          {children}
        </Paper>
      </Stack>
    </Container>
  );
}
