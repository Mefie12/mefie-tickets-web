import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box } from "@mantine/core";
import { APP_URL } from "@/lib/backend";
import { getPublicSeriesOccurrence } from "@/lib/publicEventFetchers";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { PublicEventSeriesView } from "@/components/PublicEventSeriesView";
import { RestrictedEventAccess } from "@/components/RestrictedEventAccess";

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
  if (result.status !== 200 || result.data.access_required || !result.data.event_series) return { title: "Invite-only event | Mefie Tickets", robots: { index: false, follow: false } };
  const { event_series: series } = result.data;
  const description = series.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) || `Get tickets for ${series.title}.`;
  const canonical = `${APP_URL}/${series.organization.slug}/${series.slug}/${publicOccurrenceId}`;
  const url = series.cover_social_url ?? series.cover_image_url ?? series.organization.cover_image_url ?? "/opengraph-image";
  const images = { images: [{ url, width: 1200, height: 630, alt: series.title }] };
  return {
    title: result.data.visibility === "INVITED" ? "Private event | Mefie Tickets" : `${series.title} | Mefie Tickets`,
    ...(result.data.visibility !== "PUBLIC" ? { robots: { index: false, follow: false } } : {}),
    description: result.data.visibility === "INVITED" ? "An invited event on Mefie Tickets." : description, alternates: { canonical },
    openGraph: { title: result.data.visibility === "INVITED" ? "Private event | Mefie Tickets" : series.title, description: result.data.visibility === "INVITED" ? "An invited event on Mefie Tickets." : description, url: canonical, type: "website", ...(result.data.visibility === "INVITED" ? { images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Mefie Tickets" }] } : images) },
    twitter: { card: "summary_large_image", title: result.data.visibility === "INVITED" ? "Private event | Mefie Tickets" : series.title, description: result.data.visibility === "INVITED" ? "An invited event on Mefie Tickets." : description, ...(result.data.visibility === "INVITED" ? { images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Mefie Tickets" }] } : images) },
  };
}

export default async function PublicEventSeriesOccurrencePage({
  params,
}: {
  params: Promise<{ organizationSlug: string; eventSlug: string; publicOccurrenceId: string }>;
}) {
  const { organizationSlug, eventSlug, publicOccurrenceId } = await params;

  const result = await getPublicSeriesOccurrence(organizationSlug, eventSlug, publicOccurrenceId);

  if (result.status !== 200 || result.data.access_required || !result.data.event_series) {
    if (result.status === 200 && result.data.access_required) return <RestrictedEventAccess next={`/${organizationSlug}/${eventSlug}/${publicOccurrenceId}`} />;
    notFound();
  }

  return (
    <Box>
      <PublicSiteHeader />
      <PublicEventSeriesView series={result.data.event_series} publicOccurrenceId={publicOccurrenceId} canBuy={result.data.can_buy} />
      <PublicSiteFooter />
    </Box>
  );
}
