"use client";

import { useState } from "react";
import { Carousel } from "@mantine/carousel";
import { Box, Image, Modal, SimpleGrid, UnstyledButton } from "@mantine/core";
import type { PublicEvent } from "@/lib/publicEventApi";

type GalleryImage = PublicEvent["gallery"][number];

/**
 * Small interactive island embedded in the otherwise server-rendered
 * public event page (same pattern as TermsAndConditionsLink) — only
 * this needs client state (the lightbox + the carousel itself), not
 * the whole page.
 *
 * Mobile gets a swipeable Carousel (one image at a time, better fit
 * for a narrow viewport than a stacked full-width grid); tablet/desktop
 * keeps the original side-by-side grid. Both are wired to the same
 * click-to-enlarge lightbox.
 */
export function EventGallery({ gallery }: { gallery: PublicEvent["gallery"] }) {
  const [openedImage, setOpenedImage] = useState<GalleryImage | null>(null);

  return (
    <Box maw={700}>
      <Box hiddenFrom="sm">
        <Carousel slideSize="100%" slideGap="sm" withIndicators>
          {gallery.map((image) => (
            <Carousel.Slide key={image.id}>
              <UnstyledButton onClick={() => setOpenedImage(image)} style={{ display: "block", width: "100%" }}>
                <Image src={image.url} alt={image.alt_text ?? ""} radius="md" h={220} />
              </UnstyledButton>
            </Carousel.Slide>
          ))}
        </Carousel>
      </Box>

      <SimpleGrid visibleFrom="sm" cols={{ sm: gallery.length }} spacing="sm">
        {gallery.map((image) => (
          <UnstyledButton key={image.id} onClick={() => setOpenedImage(image)}>
            <Image src={image.url} alt={image.alt_text ?? ""} radius="md" h={180} />
          </UnstyledButton>
        ))}
      </SimpleGrid>

      <Modal
        opened={openedImage !== null}
        onClose={() => setOpenedImage(null)}
        size="xl"
        padding={0}
        withCloseButton
        centered
      >
        {openedImage && (
          <Image src={openedImage.url} alt={openedImage.alt_text ?? ""} fit="contain" mah="80vh" radius="md" />
        )}
      </Modal>
    </Box>
  );
}
