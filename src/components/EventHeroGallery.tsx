"use client";

import { useState, type CSSProperties } from "react";
import { Box, Group, Image, Stack, Text, UnstyledButton } from "@mantine/core";
import { Carousel } from "@mantine/carousel";
import type { PublicEvent } from "@/lib/publicEventApi";
import { GalleryLightbox } from "@/components/GalleryLightbox";

type GalleryImage = PublicEvent["gallery"][number];

/**
 * Small interactive island embedded in the otherwise server-rendered
 * public event page (same pattern as TermsAndConditionsLink) — only
 * this needs client state (the lightbox + the carousel itself), not
 * the whole page. Owns its own lightbox rather than sharing one with
 * the separate "Event gallery" grid further down the page — the two
 * sit far apart in the page layout (this is above the two-column
 * content grid, that's deep inside it), so lifting shared state would
 * mean making a much larger chunk of the page a client component.
 *
 * Desktop: cover photo + a 2-thumbnail preview column, the last one
 * overlaid with a "View event gallery" button. Mobile: a swipeable
 * carousel of every gallery image plus a thumbnail strip below it.
 */
export function EventHeroGallery({
  coverImageUrl,
  coverPlaceholderUrl,
  gallery,
}: {
  coverImageUrl: string | null;
  coverPlaceholderUrl: string | null;
  gallery: GalleryImage[];
}) {
  const [openedIndex, setOpenedIndex] = useState<number | null>(null);
  const thumbnails = gallery.slice(0, 2);
  const hasGallery = gallery.length > 0;

  const coverStyle: CSSProperties = {
    backgroundColor: "var(--mantine-color-gray-light)",
    backgroundImage: coverImageUrl
      ? [`url(${coverImageUrl})`, coverPlaceholderUrl ? `url(${coverPlaceholderUrl})` : null].filter(Boolean).join(", ")
      : undefined,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  return (
    <Box>
      <Group visibleFrom="md" gap={8} wrap="nowrap" align="stretch" h={354}>
        <Box style={{ flex: 1, minWidth: 0, borderRadius: "var(--mantine-radius-lg)", overflow: "hidden", ...coverStyle }} />
        {hasGallery && (
          <Stack gap={8} w={297} style={{ flexShrink: 0 }}>
            {thumbnails.map((image, index) => (
              <UnstyledButton
                key={image.id}
                onClick={() => setOpenedIndex(index)}
                style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", borderRadius: "var(--mantine-radius-lg)" }}
              >
                <Image src={image.thumbnail_url} alt={image.alt_text ?? ""} h="100%" fit="cover" />
                {index === thumbnails.length - 1 && (
                  <Box
                    pos="absolute"
                    inset={0}
                    bg="rgba(0,0,0,0.4)"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <Text c="white" fw={600} size="sm">
                      View event gallery
                    </Text>
                  </Box>
                )}
              </UnstyledButton>
            ))}
          </Stack>
        )}
      </Group>

      <Box hiddenFrom="md">
        {hasGallery ? (
          <Carousel slideSize="100%" slideGap="sm" withIndicators>
            {gallery.map((image, index) => (
              <Carousel.Slide key={image.id}>
                <UnstyledButton onClick={() => setOpenedIndex(index)} style={{ display: "block", width: "100%" }}>
                  <Image src={image.url} alt={image.alt_text ?? ""} radius="lg" h={220} fit="cover" />
                </UnstyledButton>
              </Carousel.Slide>
            ))}
          </Carousel>
        ) : (
          <Box h={220} style={{ borderRadius: "var(--mantine-radius-lg)", overflow: "hidden", ...coverStyle }} />
        )}
        {gallery.length > 1 && (
          <Group gap={8} mt={8} wrap="nowrap" style={{ overflowX: "auto" }}>
            {gallery.map((image, index) => (
              <UnstyledButton
                key={image.id}
                onClick={() => setOpenedIndex(index)}
                style={{ flexShrink: 0, width: 64, height: 64, borderRadius: "var(--mantine-radius-md)", overflow: "hidden" }}
              >
                <Image src={image.thumbnail_url} alt={image.alt_text ?? ""} h="100%" fit="cover" />
              </UnstyledButton>
            ))}
          </Group>
        )}
      </Box>

      <GalleryLightbox
        gallery={gallery}
        openedIndex={openedIndex}
        onClose={() => setOpenedIndex(null)}
        onNavigate={setOpenedIndex}
      />
    </Box>
  );
}
