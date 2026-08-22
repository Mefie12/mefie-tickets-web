import Link from "next/link";
import { Box, Container, Divider, Group, Stack, Text } from "@mantine/core";
import { IconTicket } from "@tabler/icons-react";

export function PublicSiteFooter() {
  const links = [["/discover", "Discover events"], ["/register", "Create event"], ["/login", "Organizer login"]];
  return (
    <Box component="footer" mt={80} py={48} style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
      <Container size="xl">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap="xs"><Group gap="xs"><IconTicket size={20}/><Text fw={800}>Mefie Tickets</Text></Group><Text c="dimmed" size="sm">Discover experiences worth showing up for.</Text></Stack>
          <Group gap="xl">{links.map(([href, label]) => <Link key={href} href={href} style={{ color: "var(--mantine-color-dimmed)", fontSize: "var(--mantine-font-size-sm)", textDecoration: "none" }}>{label}</Link>)}</Group>
        </Group>
        <Divider my="xl"/><Text c="dimmed" size="xs">© {new Date().getFullYear()} Mefie Tickets</Text>
      </Container>
    </Box>
  );
}
