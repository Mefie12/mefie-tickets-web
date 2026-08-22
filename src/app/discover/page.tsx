import type { Metadata } from "next";
import { Card, Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconTicket } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import type { PaginationMeta, PublicEventCard as PublicEventCardData, PublicEventTaxonomies } from "@/lib/publicEventApi";
import { EventFilterBar } from "@/components/EventFilterBar";
import { EventCard } from "@/components/EventCard";
import { EventPaginationControl } from "@/components/EventPaginationControl";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
type SearchParams = { q?: string; category?: string; subcategory?: string; country?: string; from?: string; to?: string; page?: string };
function buildQueryString(params: SearchParams): string { const query = new URLSearchParams(); for (const key of ["q","category","subcategory","country","from","to","page"] as const) if (params[key]) query.set(key, params[key]!); return query.toString(); }
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> { const params = await searchParams; const query = buildQueryString(params); return { title: params.category ? `${params.category} events | Mefie Tickets` : "Discover events | Mefie Tickets", description: "Find and buy tickets to live events.", alternates: { canonical: `${APP_URL}/discover${query ? `?${query}` : ""}` } }; }
export default async function DiscoverPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams; const query = buildQueryString(params);
  const [eventsResult, taxonomiesResult] = await Promise.all([backendRequest<{ events: PublicEventCardData[]; meta: PaginationMeta }>(`/api/public/events${query ? `?${query}` : ""}`), backendRequest<PublicEventTaxonomies>("/api/public/event-taxonomies")]);
  const events = eventsResult.status === 200 ? eventsResult.data.events : []; const meta = eventsResult.status === 200 ? eventsResult.data.meta : null; const taxonomies = taxonomiesResult.status === 200 ? taxonomiesResult.data : { categories: [] };
  return <><PublicSiteHeader/><Container size="xl" py={48}><Stack gap="xl"><Stack gap={4}><Title order={1} fz={42}>Discover events</Title><Text c="dimmed">Find live experiences by event, organizer, venue, city, category, or date.</Text></Stack><EventFilterBar taxonomies={taxonomies}/>{events.length === 0 ? <Card withBorder p="xl"><Stack align="center" py="lg"><IconTicket size={34} opacity={.5}/><Text c="dimmed">No events match your filters.</Text></Stack></Card> : <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="lg">{events.map((event) => <EventCard key={event.id} event={event}/>)}</SimpleGrid>}{meta && meta.last_page > 1 && <EventPaginationControl currentPage={meta.current_page} totalPages={meta.last_page}/>}</Stack></Container><PublicSiteFooter/></>;
}
