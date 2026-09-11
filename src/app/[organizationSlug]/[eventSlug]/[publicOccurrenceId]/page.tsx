import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box } from "@mantine/core";
import { APP_URL } from "@/lib/backend";
import { getPublicSeriesOccurrence } from "@/lib/publicEventFetchers";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { PublicEventSeriesView } from "@/components/PublicEventSeriesView";

/**
 * §7.2 — a specific series occurrence, independently bookmarkable and
 * shareable: `/{organizationSlug}/{seriesSlug}/{publicOccurrenceId}`.
 * `eventSlug` here is actually always a *series* slug — only a series
 * has occurrences, so a standalone event never reaches this route (its
 * own detail page has no third path segment to begin with).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string; publicOccurrenceId: string }>;
}): Promise<Metadata> {
  const { organizationSlug, eventSlug, publicOccurrenceId } = await params;
  const result = await getPublicSeriesOccurrence(organizationSlug, eventSlug, publicOccurrenceId);
  if (result.status !== 200) return {};
  const { event_series: series } = result.data;
  const description = series.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || `Get tickets for ${series.title}.`;
  const canonical = `${APP_URL}/${series.organization.slug}/${series.slug}/${publicOccurrenceId}`;
  const url = series.cover_social_url ?? series.cover_image_url ?? series.organization.cover_image_url;
  const images = url ? { images: [{ url, width: 1200, height: 630, alt: series.title }] } : {};
  return {
    title: `${series.title} | Mefie Tickets`, description, alternates: { canonical },
    openGraph: { title: series.title, description, url: canonical, type: "website", ...images },
    twitter: { card: "summary_large_image", title: series.title, description, ...images },
  };
}

export default async function PublicEventSeriesOccurrencePage({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string; publicOccurrenceId: string }>;
}) {
  const { organizationSlug, eventSlug, publicOccurrenceId } = await params;

  const result = await getPublicSeriesOccurrence(organizationSlug, eventSlug, publicOccurrenceId);

  if (result.status !== 200) {
    notFound();
  }

  return (
    <Box>
      <PublicSiteHeader />
      <PublicEventSeriesView series={result.data.event_series} publicOccurrenceId={publicOccurrenceId} />
      <PublicSiteFooter />
    </Box>
  );
}
