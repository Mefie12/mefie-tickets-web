import type { Metadata } from "next";
import { Container, SimpleGrid, Stack, Text, Title, Card } from "@mantine/core";
import { IconTicket } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import type { PaginationMeta, PublicEventCard as PublicEventCardData, PublicEventTaxonomies } from "@/lib/publicEventApi";
import { EventFilterBar } from "@/components/EventFilterBar";
import { EventCard } from "@/components/EventCard";
import { EventPaginationControl } from "@/components/EventPaginationControl";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

type SearchParams = {
  q?: string;
  category?: string;
  subcategory?: string;
  country?: string;
  from?: string;
  to?: string;
  page?: string;
};

function buildQueryString(params: SearchParams): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.subcategory) query.set("subcategory", params.subcategory);
  if (params.country) query.set("country", params.country);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.page) query.set("page", params.page);
  return query.toString();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const title = params.category ? `${params.category} events | Mefie Tickets` : "Browse events | Mefie Tickets";
  const description = "Find and buy tickets to live events.";
  const query = buildQueryString(params);
  const canonicalPath = query ? `/?${query}` : "/";

  return {
    title,
    description,
    alternates: { canonical: `${APP_URL}${canonicalPath}` },
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = buildQueryString(params);

  const [eventsResult, taxonomiesResult] = await Promise.all([
    backendRequest<{ events: PublicEventCardData[]; meta: PaginationMeta }>(`/api/public/events${query ? `?${query}` : ""}`),
    backendRequest<PublicEventTaxonomies>("/api/public/event-taxonomies"),
  ]);

  const events = eventsResult.status === 200 ? eventsResult.data.events : [];
  const meta = eventsResult.status === 200 ? eventsResult.data.meta : null;
  const taxonomies: PublicEventTaxonomies =
    taxonomiesResult.status === 200 ? taxonomiesResult.data : { categories: [] };

  return (
    <>
      <PublicSiteHeader />
      <Container size="lg" py={40}>
        <Stack gap="xl">
          <Stack gap={4}>
            <Title order={1} fz={34} fw={800}>
              Browse events
            </Title>
            <Text c="dimmed">Find and buy tickets to live events.</Text>
          </Stack>

          <EventFilterBar taxonomies={taxonomies} />

          {events.length === 0 ? (
            <Card withBorder radius="lg" p="xl">
              <Stack align="center" gap="xs" py="lg">
                <IconTicket size={32} opacity={0.5} />
                <Text c="dimmed" ta="center">
                  No events match your filters.
                </Text>
              </Stack>
            </Card>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </SimpleGrid>
          )}

          {meta && meta.last_page > 1 && (
            <EventPaginationControl currentPage={meta.current_page} totalPages={meta.last_page} />
          )}
        </Stack>
      </Container>
    </>
  );
}
