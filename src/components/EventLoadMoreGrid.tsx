"use client";

import { useState } from "react";
import { Button, Center, SimpleGrid, Stack } from "@mantine/core";
import { EventCard } from "@/components/EventCard";
import type { PaginationMeta, PublicEventCard as PublicEventCardData } from "@/lib/publicEventApi";

/**
 * The first page is server-rendered (SEO, fast first paint) and passed
 * in as props; "Load More" fetches subsequent pages from the
 * client-reachable /api/public/events passthrough and appends them —
 * matching the Figma "Browse Events" interaction instead of numbered
 * pages.
 */
export function EventLoadMoreGrid({
  initialEvents,
  initialMeta,
  queryString,
}: {
  initialEvents: PublicEventCardData[];
  initialMeta: PaginationMeta | null;
  queryString: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!meta || loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams(queryString);
      params.set("page", String(meta.current_page + 1));
      const response = await fetch(`/api/public/events?${params.toString()}`);
      if (response.ok) {
        const data: { events: PublicEventCardData[]; meta: PaginationMeta } = await response.json();
        setEvents((prev) => [...prev, ...data.events]);
        setMeta(data.meta);
      }
    } finally {
      setLoading(false);
    }
  }

  const hasMore = meta ? meta.current_page < meta.last_page : false;

  return (
    <Stack gap="xl">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="lg">
        {events.map((event) => (
          <EventCard key={event.id} event={event} compact={false} />
        ))}
      </SimpleGrid>
      {hasMore && (
        <Center>
          <Button variant="outline" onClick={loadMore} loading={loading}>
            Load More
          </Button>
        </Center>
      )}
    </Stack>
  );
}
