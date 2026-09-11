"use client";

import { ActionIcon, Image, Modal } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { PublicEvent } from "@/lib/publicEventApi";

type GalleryImage = PublicEvent["gallery"][number];

/**
 * Shared by the hero thumbnail preview and the full gallery grid below
 * it — both open the same lightbox instance rather than each owning
 * its own modal, so "the photo you clicked" is always what opens.
 */
export function GalleryLightbox({
  gallery,
  openedIndex,
  onClose,
  onNavigate,
}: {
  gallery: GalleryImage[];
  openedIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const image = openedIndex !== null ? gallery[openedIndex] : null;

  return (
    <Modal opened={image !== null} onClose={onClose} size="xl" padding={0} withCloseButton centered>
      {image && openedIndex !== null && (
        <div style={{ position: "relative" }}>
          <Image src={image.url} alt={image.alt_text ?? ""} fit="contain" mah="80vh" radius="md" />
          {gallery.length > 1 && (
            <>
              <ActionIcon
                aria-label="Previous photo"
                variant="filled"
                color="dark"
                radius="xl"
                pos="absolute"
                top="50%"
                left={12}
                style={{ transform: "translateY(-50%)" }}
                onClick={() => onNavigate((openedIndex - 1 + gallery.length) % gallery.length)}
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <ActionIcon
                aria-label="Next photo"
                variant="filled"
                color="dark"
                radius="xl"
                pos="absolute"
                top="50%"
                right={12}
                style={{ transform: "translateY(-50%)" }}
                onClick={() => onNavigate((openedIndex + 1) % gallery.length)}
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
