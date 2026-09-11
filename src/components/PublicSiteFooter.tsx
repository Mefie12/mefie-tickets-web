import Link from "next/link";
import { Box, Container, Divider, Group, Stack, Text } from "@mantine/core";
import { IconTicket } from "@tabler/icons-react";
import { PrivacyChoicesLink } from "@/components/privacy/PrivacyChoicesLink";

const LINK_STYLE = { color: "var(--mantine-color-dimmed)", fontSize: "var(--mantine-font-size-sm)", textDecoration: "none" } as const;

export function PublicSiteFooter() {
  const links = [["/discover", "Discover events"], ["/login", "Log in"], ["/register", "Sign up"], ["/organizers", "Why Mefie for organizers"], ["/organizers/register", "Create an organization"], ["/organizers/login", "Organizer login"]];
  return (
    <Box component="footer" mt={80} py={48} style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
      <Container size="xl">
        <Stack gap="xl">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl">
            <Stack gap="xs"><Group gap="xs"><IconTicket size={20}/><Text fw={800}>Mefie Tickets</Text></Group><Text c="dimmed" size="sm">Discover experiences worth showing up for.</Text></Stack>
            <Stack gap="md" hiddenFrom="sm">{links.map(([href, label]) => <Link key={href} href={href} style={LINK_STYLE}>{label}</Link>)}<PrivacyChoicesLink style={LINK_STYLE} /></Stack>
            <Group gap="xl" visibleFrom="sm">{links.map(([href, label]) => <Link key={href} href={href} style={LINK_STYLE}>{label}</Link>)}<PrivacyChoicesLink style={LINK_STYLE} /></Group>
          </Group>
          <Divider/>
          <Text c="dimmed" size="xs">© {new Date().getFullYear()} Mefie Tickets. All rights reserved.</Text>
        </Stack>
      </Container>
    </Box>
  );
}
