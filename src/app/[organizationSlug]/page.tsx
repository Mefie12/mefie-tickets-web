import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Avatar, Box, Card, Container, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconCalendarOff, IconMail } from "@tabler/icons-react";
import { APP_URL, backendRequest } from "@/lib/backend";
import type { PaginationMeta, PublicEventCard, PublicOrganization } from "@/lib/publicEventApi";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { EventCard } from "@/components/EventCard";
import { EventPaginationControl } from "@/components/EventPaginationControl";
import { OrganizationEventTabs } from "@/components/OrganizationEventTabs";

type Params = { organizationSlug: string };
type SearchParams = { view?: string; page?: string };

async function getOrganization(slug: string) {
  return backendRequest<{ organization: PublicOrganization }>(`/api/public/organizations/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { organizationSlug } = await params;
  const result = await getOrganization(organizationSlug);
  if (result.status !== 200) return {};
  const organization = result.data.organization;
  const description = organization.description || `Discover public events from ${organization.name}.`;
  const canonical = `${APP_URL}/${organization.slug}`;
  const image = organization.cover_image_url ?? organization.logo_url;
  return {
    title: `${organization.name} events | Mefie Tickets`,
    description,
    alternates: { canonical },
    openGraph: { title: organization.name, description, url: canonical, type: "website", ...(image ? { images: [image] } : {}) },
    twitter: { card: "summary_large_image", title: organization.name, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function OrganizationStorefront({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SearchParams> }) {
  const [{ organizationSlug }, query] = await Promise.all([params, searchParams]);
  const view: "upcoming" | "past" = query.view === "past" ? "past" : "upcoming";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const [organizationResult, eventsResult] = await Promise.all([
    getOrganization(organizationSlug),
    backendRequest<{ events: PublicEventCard[]; meta: PaginationMeta }>(`/api/public/organizations/${encodeURIComponent(organizationSlug)}/events?view=${view}&page=${page}`),
  ]);
  if (organizationResult.status !== 200 || eventsResult.status !== 200) notFound();
  const organization = organizationResult.data.organization;
  const { events, meta } = eventsResult.data;

  return (
    <Box>
      <PublicSiteHeader />
      <Box h="clamp(180px, 30vw, 300px)" pos="relative" style={{ backgroundColor: "var(--mantine-color-gray-light)", backgroundImage: organization.cover_image_url ? `linear-gradient(rgba(0,0,0,.18), rgba(0,0,0,.54)), url(${organization.cover_image_url})` : "linear-gradient(135deg, var(--mantine-color-brand-light), var(--mantine-primary-color-filled))", backgroundSize: "cover", backgroundPosition: "center" }} />
      <Container size="lg" pb={48}>
        <Stack gap="xl">
          <Group align="flex-end" justify="space-between" wrap="wrap" mt={-48} style={{ position: "relative" }}>
            <Group align="flex-end" wrap="nowrap">
              <Avatar src={organization.logo_url} size={96} radius="xl" color="brand" style={{ border: "4px solid var(--mantine-color-body)", flexShrink: 0 }}>{organization.name[0]}</Avatar>
              <Title order={1} fz="clamp(1.75rem, 4vw, 2.5rem)" mb={8}>{organization.name}</Title>
            </Group>
          </Group>
          <Stack gap="sm" maw={720}>
            {organization.description && <Text c="dimmed" style={{ whiteSpace: "pre-wrap" }}>{organization.description}</Text>}
            <Group gap={7} wrap="nowrap"><IconMail size={17} aria-hidden /><Text component="a" href={`mailto:${organization.email}`} size="sm" style={{ overflowWrap: "anywhere" }}>{organization.email}</Text></Group>
          </Stack>
          <OrganizationEventTabs slug={organization.slug} value={view} />
          {events.length ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">{events.map((event) => <EventCard key={event.id} event={event} />)}</SimpleGrid>
          ) : (
            <Card withBorder radius="lg" p="xl"><Stack align="center" gap="xs" py="lg"><IconCalendarOff size={34} opacity={0.55} /><Text fw={600}>{view === "past" ? "No past events yet" : "No upcoming events yet"}</Text><Text c="dimmed" ta="center" size="sm">{view === "past" ? "Completed events from this organization will appear here." : "Check back soon for new events from this organization."}</Text></Stack></Card>
          )}
          {meta.last_page > 1 && <EventPaginationControl currentPage={meta.current_page} totalPages={meta.last_page} />}
        </Stack>
      </Container>
      <PublicSiteFooter />
    </Box>
  );
}
