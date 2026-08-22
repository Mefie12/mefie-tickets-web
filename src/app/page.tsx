import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, Container, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconArrowRight, IconCalendarEvent } from "@tabler/icons-react";
import { backendRequest } from "@/lib/backend";
import type { PaginationMeta, PublicEventCard as PublicEventCardData, PublicEventTaxonomies } from "@/lib/publicEventApi";
import { EventCard } from "@/components/EventCard";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { HomeHero } from "@/components/HomeHero";
import { LinkButton } from "@/components/LinkButton";
import { HomeFaq } from "@/components/HomeFaq";

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

export const metadata: Metadata = { title: "Mefie Tickets | Discover live experiences", description: "Discover concerts, festivals, parties and events from organizers across Ghana and beyond.", alternates: { canonical: APP_URL } };

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams; const query = buildQueryString(params);
  if (query) redirect(`/discover?${query}`);

  const [eventsResult, taxonomiesResult, featuredResult] = await Promise.all([
    backendRequest<{ events: PublicEventCardData[]; meta: PaginationMeta }>("/api/public/events"),
    backendRequest<PublicEventTaxonomies>("/api/public/event-taxonomies"),
    backendRequest<{ events: PublicEventCardData[] }>("/api/public/featured-events"),
  ]);

  const events = eventsResult.status === 200 ? eventsResult.data.events : [];
  const taxonomies: PublicEventTaxonomies =
    taxonomiesResult.status === 200 ? taxonomiesResult.data : { categories: [] };
  const featuredEvents = featuredResult.status === 200 ? featuredResult.data.events : [];
  const featuredIds = new Set(featuredEvents.map((event) => event.id)); const upcoming = events.filter((event) => !featuredIds.has(event.id)).slice(0, 8);
  const section = (title: string, items: PublicEventCardData[], empty: string) => <Stack gap="lg"><Group justify="space-between"><Title order={2}>{title}</Title><LinkButton href="/discover" variant="subtle" rightSection={<IconArrowRight size={16}/>}>See all</LinkButton></Group>{items.length ? <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>{items.map((event) => <EventCard key={event.id} event={event}/>)}</SimpleGrid> : <Card withBorder p="xl"><Text c="dimmed">{empty}</Text></Card>}</Stack>;
  return <><PublicSiteHeader/><HomeHero/><Container size="xl"><Stack gap={72}>{section("Featured events", featuredEvents, "Featured experiences are being curated. Check back soon.")}{section("Coming up next", upcoming, "New live events will appear here as organizers publish them.")}<Stack gap="lg"><Title order={2}>Explore by category</Title>{taxonomies.categories.length ? <Group>{taxonomies.categories.map((category) => <LinkButton key={category.id} href={`/discover?category=${category.slug}`} variant="default">{category.name}</LinkButton>)}</Group> : <Text c="dimmed">Categories will appear as events are added.</Text>}</Stack><Card p={{ base: "xl", md: 48 }} style={{ background: "linear-gradient(135deg, var(--mantine-color-brand-9), var(--mantine-color-grape-9))" }}><Group justify="space-between" align="center"><Stack maw={650}><IconCalendarEvent size={32}/><Title order={2}>Your audience is already looking.</Title><Text c="gray.2">Create your organizer account, publish an event, and start selling tickets.</Text></Stack><LinkButton href="/register" size="lg" color="dark">Create an event</LinkButton></Group></Card><HomeFaq/></Stack></Container><PublicSiteFooter/></>;
}
