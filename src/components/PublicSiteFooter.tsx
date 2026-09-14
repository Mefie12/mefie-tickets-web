import Link from "next/link";
import { Box, Container, Divider, Flex, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconTicket } from "@tabler/icons-react";
import { PrivacyChoicesLink } from "@/components/privacy/PrivacyChoicesLink";

const LINK_STYLE = { color: "var(--mantine-color-dimmed)", fontSize: "var(--mantine-font-size-sm)", textDecoration: "none" } as const;

/**
 * The link list only ever sits comfortably beside the brand block on a
 * genuinely wide screen (confirmed visually at 1440px — the natural,
 * auto-width Group below). Below that, forcing the same one-row layout
 * just wraps mid-row against the container edge, which looked like an
 * unstyled accident rather than a design — so everything under `xl`
 * gets its own tidy multi-column grid instead of fighting for one row.
 */
export function PublicSiteFooter() {
  const links = [["/discover", "Discover events"], ["/login", "Log in"], ["/register", "Sign up"], ["/organizers", "Why Mefie for organizers"], ["/organizers/register", "Create an organization"], ["/organizers/login", "Organizer login"]];
  return (
    <Box component="footer" mt={{ base: 40, sm: 56, xl: 80 }} py={{ base: 32, sm: 40, xl: 48 }} style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
      <Container size="xl">
        <Stack gap="lg">
          <Flex direction={{ base: "column", xl: "row" }} justify="space-between" align={{ base: "flex-start", xl: "center" }} gap="lg">
            <Stack gap="xs">
              <Group gap="xs">
                <IconTicket size={20} />
                <Text fw={800}>Mefie Tickets</Text>
              </Group>
              <Text c="dimmed" size="sm">
                Discover experiences worth showing up for.
              </Text>
            </Stack>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md" verticalSpacing="sm" hiddenFrom="xl" w={{ base: "100%", sm: "auto" }}>
              {links.map(([href, label]) => (
                <Link key={href} href={href} style={LINK_STYLE}>
                  {label}
                </Link>
              ))}
              <PrivacyChoicesLink style={LINK_STYLE} />
            </SimpleGrid>
            <Group gap="xl" visibleFrom="xl">
              {links.map(([href, label]) => (
                <Link key={href} href={href} style={LINK_STYLE}>
                  {label}
                </Link>
              ))}
              <PrivacyChoicesLink style={LINK_STYLE} />
            </Group>
          </Flex>
          <Divider />
          <Text c="dimmed" size="xs">
            © {new Date().getFullYear()} Mefie Tickets. All rights reserved.
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}
