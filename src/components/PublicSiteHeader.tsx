import Link from "next/link";
import { Box, Container, Group, Text } from "@mantine/core";
import { IconTicket } from "@tabler/icons-react";

/**
 * The only persistent navigation on the public storefront (landing page
 * + event detail page + the checkout wizard embedded in it). Sticky so
 * it stays reachable no matter how far a buyer has scrolled or which
 * checkout step they're on — the wizard itself has no "return to
 * events" control (the payment step deliberately has no back button at
 * all, see Checkout.tsx), so this is the one way back that survives
 * every step without touching that state machine.
 *
 * Plain Server Component: `Link` is used as a normal wrapping element
 * here, never passed as a prop into a Mantine component, so it doesn't
 * hit the Next 16 "component={Link}" Client/Server boundary issue (see
 * LinkButton.tsx/LinkCard.tsx for where that pattern is needed instead).
 */
export function PublicSiteHeader() {
  return (
    <Box
      component="header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backgroundColor: "var(--mantine-color-body)",
        borderBottom: "1px solid var(--mantine-color-dark-4)",
      }}
    >
      <Container size="lg">
        <Link href="/" style={{ textDecoration: "none", display: "block", width: "fit-content" }}>
          <Group h={52} gap="xs">
            <IconTicket size={20} />
            <Text fw={700} c="var(--mantine-color-text)">
              Mefie Tickets
            </Text>
          </Group>
        </Link>
      </Container>
    </Box>
  );
}
