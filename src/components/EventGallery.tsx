"use client";

import { useState } from "react";
import { Button, Group, Image, SimpleGrid, Title, UnstyledButton } from "@mantine/core";
import type { PublicEvent } from "@/lib/publicEventApi";
import { GalleryLightbox } from "@/components/GalleryLightbox";

/**
 * The full "Event gallery" section further down the page — every
 * photo, in a responsive grid, with its own lightbox (see
 * EventHeroGallery's docblock for why this doesn't share state with
 * the hero preview above it).
 */
export function EventGallery({ gallery }: { gallery: PublicEvent["gallery"] }) {
  const [openedIndex, setOpenedIndex] = useState<number | null>(null);

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={2} fz={{ base: 22, md: 28 }}>
          Event gallery
        </Title>
        <Button variant="default" size="compact-sm" onClick={() => setOpenedIndex(0)}>
          View all photos
        </Button>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
        {gallery.map((image, index) => (
          <UnstyledButton
            key={image.id}
            onClick={() => setOpenedIndex(index)}
            style={{ borderRadius: "var(--mantine-radius-md)", overflow: "hidden" }}
          >
            <Image src={image.thumbnail_url} alt={image.alt_text ?? ""} radius="md" h={180} fit="cover" />
          </UnstyledButton>
        ))}
      </SimpleGrid>

      <GalleryLightbox
        gallery={gallery}
        openedIndex={openedIndex}
        onClose={() => setOpenedIndex(null)}
        onNavigate={setOpenedIndex}
      />
    </div>
  );
}
