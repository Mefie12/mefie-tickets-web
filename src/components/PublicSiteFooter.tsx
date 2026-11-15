import Link from "next/link";
import { Box, Container, Divider, Flex, SimpleGrid, Stack, Text } from "@mantine/core";
import { PrivacyChoicesLink } from "@/components/privacy/PrivacyChoicesLink";
import { MefieLogo } from "@/components/MefieLogo";
import { getFooterLegalDocuments } from "@/lib/legalServer";

// Footer links sit one step darker than "dimmed" so they stay readable; titles are the brand navy.
const LINK_COLOR = "light-dark(var(--mantine-color-gray-7), var(--mantine-color-dark-1))";
const LINK_STYLE = { color: LINK_COLOR, fontSize: "var(--mantine-font-size-sm)", lineHeight: 1.4, textDecoration: "none" } as const;

type FooterLink = { href: string; label: string };

const STATIC_COLUMNS: { title: string; links: FooterLink[] }[] = [
  { title: "Explore", links: [{ href: "/discover", label: "Discover events" }] },
  { title: "Account", links: [{ href: "/login", label: "Log in" }, { href: "/register", label: "Sign up" }] },
  {
    title: "For organizers",
    links: [
      { href: "/organizers", label: "Why Mefie for organizers" },
      { href: "/organizers/register", label: "Create an organization" },
      { href: "/organizers/login", label: "Organization login" },
    ],
  },
];

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="lg" component="nav" aria-label={title}>
      <Text component="h2" fw={700} size="sm" tt="uppercase" c="brand.8" style={{ letterSpacing: "0.04em", margin: 0 }}>
        {title}
      </Text>
      <Stack gap={14}>{children}</Stack>
    </Stack>
  );
}

/**
 * Links are grouped under titled columns (as Yelp, Eventbrite and others do), so a new
 * entry — including any legal document an admin publishes to the footer — adds a line to
 * its column instead of lengthening one long row. Two columns on phones, four from `sm` up.
 */
export async function PublicSiteFooter() {
  const legalDocuments = await getFooterLegalDocuments();
  return (
    <Box component="footer" mt={{ base: 40, sm: 56, xl: 80 }} py={{ base: 32, sm: 40, xl: 48 }} style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
      <Container size="xl">
        <Stack gap="xl">
          <Flex direction={{ base: "column", lg: "row" }} justify="space-between" gap="xl">
            <Stack gap="xs" maw={280} style={{ flexShrink: 0 }}>
              <MefieLogo h={24} />
              <Text c="dimmed" size="sm">
                Discover experiences worth showing up for.
              </Text>
            </Stack>
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl" verticalSpacing={40} w={{ base: "100%", lg: "auto" }} style={{ flexGrow: 1, maxWidth: 760 }}>
              {STATIC_COLUMNS.map((column) => (
                <FooterColumn key={column.title} title={column.title}>
                  {column.links.map((link) => (
                    <Link key={link.href} href={link.href} style={LINK_STYLE}>
                      {link.label}
                    </Link>
                  ))}
                </FooterColumn>
              ))}
              <FooterColumn title="Legal">
                {legalDocuments.map((document) => (
                  <Link key={document.slug} href={`/legal/${document.slug}`} style={LINK_STYLE}>
                    {document.name}
                  </Link>
                ))}
                <PrivacyChoicesLink style={LINK_STYLE} color={LINK_COLOR} />
              </FooterColumn>
            </SimpleGrid>
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
