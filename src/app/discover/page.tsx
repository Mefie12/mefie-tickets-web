import type { Metadata } from "next";
import { Container, Stack, Text, Title } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import type { PaginationMeta, PublicEventCard as PublicEventCardData, PublicEventTaxonomies } from "@/lib/publicEventApi";
import { COUNTRIES_BY_CODE } from "@/lib/countries";
import { EventFilterBar } from "@/components/EventFilterBar";
import { EventLoadMoreGrid } from "@/components/EventLoadMoreGrid";
import { DiscoverHero } from "@/components/DiscoverHero";
import { DiscoverSectionRow } from "@/components/DiscoverSectionRow";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
type SearchParams = {
  q?: string;
  category?: string;
  subcategory?: string;
  country?: string;
  from?: string;
  to?: string;
  page?: string;
  /** Marker only — forces the browse/listing view for "View all events" links that have no real filter to carry (Featured, Coming up next). Never sent to the backend. */
  all?: string;
};

function buildQueryString(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const key of ["q", "category", "subcategory", "country", "from", "to", "page"] as const) {
    if (params[key]) query.set(key, params[key]!);
  }
  return query.toString();
}

/** The current-or-upcoming Friday-Sunday window, in UTC — an approximation ("cut to what's real today", no real ranking yet), not organizer-timezone-exact. */
function weekendRange(): { from: string; to: string } {
  const now = new Date();
  const mappedDay = (now.getUTCDay() - 5 + 7) % 7; // Fri=0 .. Thu=6
  const offsetToFriday = mappedDay <= 2 ? -mappedDay : 7 - mappedDay;
  const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetToFriday));
  const sunday = new Date(Date.UTC(friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate() + 2));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(friday), to: fmt(sunday) };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const query = buildQueryString(params);
  return {
    title: params.category ? `${params.category} events | Mefie Tickets` : "Discover events | Mefie Tickets",
    description: "Find and buy tickets to live events.",
    alternates: { canonical: `${APP_URL}/discover${query ? `?${query}` : ""}` },
  };
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = buildQueryString(params);
  const isBrowseView = Boolean(query) || Boolean(params.all);

  const taxonomiesResult = await backendRequest<PublicEventTaxonomies>("/api/public/event-taxonomies");
  const taxonomies: PublicEventTaxonomies = taxonomiesResult.status === 200 ? taxonomiesResult.data : { categories: [] };

  return (
    <>
      <PublicSiteHeader />
      {isBrowseView ? <BrowseHeader /> : <DiscoverHero />}
      <Container size="xl" py={{ base: 20, md: 32 }}>
        <Stack gap="md">
          <EventFilterBar taxonomies={taxonomies} showCategoryChips={isBrowseView} />
        </Stack>
      </Container>

      {isBrowseView ? <BrowseResults query={query} country={params.country} /> : <CuratedSections />}

      <PublicSiteFooter />
    </>
  );
}

function BrowseHeader() {
  return (
    <Container size="xl" pt={{ base: 20, md: 32 }}>
      <Stack gap={4}>
        <Title order={1} fz={{ base: 24, md: 32 }}>
          Browse Events
        </Title>
        <Text c="dimmed">Discover events happening around you</Text>
      </Stack>
    </Container>
  );
}

async function BrowseResults({ query, country }: { query: string; country?: string }) {
  const eventsResult = await backendRequest<{ events: PublicEventCardData[]; meta: PaginationMeta }>(
    `/api/public/events${query ? `?${query}` : ""}`,
  );
  const events = eventsResult.status === 200 ? eventsResult.data.events : [];
  const meta = eventsResult.status === 200 ? eventsResult.data.meta : null;
  const countryLabel = country ? COUNTRIES_BY_CODE.get(country.toUpperCase())?.name : undefined;

  return (
    <Container size="xl" pb={80}>
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          Showing {meta?.total ?? events.length} event{(meta?.total ?? events.length) === 1 ? "" : "s"}
          {countryLabel ? ` in ${countryLabel}` : ""}
        </Text>
        {events.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No events match your filters.
          </Text>
        ) : (
          // `key={query}` forces a remount on every filter change — EventLoadMoreGrid holds
          // its accumulated events in useState, which would otherwise keep stale results
          // from the previous filter after a client-side navigation to a new query.
          <EventLoadMoreGrid key={query} initialEvents={events} initialMeta={meta} queryString={query} />
        )}
      </Stack>
    </Container>
  );
}

async function CuratedSections() {
  const { from, to } = weekendRange();
  const [eventsResult, featuredResult, weekendResult] = await Promise.all([
    backendRequest<{ events: PublicEventCardData[]; meta: PaginationMeta }>("/api/public/events"),
    backendRequest<{ events: PublicEventCardData[] }>("/api/public/featured-events"),
    backendRequest<{ events: PublicEventCardData[]; meta: PaginationMeta }>(`/api/public/events?from=${from}&to=${to}`),
  ]);

  const events = eventsResult.status === 200 ? eventsResult.data.events : [];
  const featuredEvents = featuredResult.status === 200 ? featuredResult.data.events : [];
  const weekendEvents = weekendResult.status === 200 ? weekendResult.data.events : [];
  const featuredIds = new Set(featuredEvents.map((event) => event.id));
  const upcoming = events.filter((event) => !featuredIds.has(event.id));

  return (
    <Container size="xl" py={{ base: 24, md: 64 }}>
      <Stack gap={48}>
        <DiscoverSectionRow
          title="Featured Events"
          subtitle="Hand-picked experiences you don't want to miss."
          events={featuredEvents}
          viewAllHref="/discover?all=1"
        />
        <DiscoverSectionRow
          title="Coming up next"
          subtitle="Fresh events from organizers across the platform."
          events={upcoming}
          viewAllHref="/discover?all=1"
        />
        <DiscoverSectionRow
          title="Happening this weekend"
          subtitle="Don't miss out — these events are just days away."
          events={weekendEvents}
          viewAllHref={`/discover?from=${from}&to=${to}`}
        />
      </Stack>
    </Container>
  );
}
