"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { ActionIcon, Badge, Button, Card, Group, Image, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconCrop, IconPhoto, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import type { Event } from "@/lib/eventApi";
import {
  deleteEventCoverImage,
  deleteEventGalleryImage,
  recropEventCover,
  reorderEventGallery,
  updateEventGalleryImageAltText,
  uploadEventCoverImage,
  uploadEventGalleryImage,
} from "@/lib/eventMediaApi";
import { ImageCropModal } from "@/components/ImageCropModal";
import { centeredCrop, coverOutcome, type PixelCrop, readImageSize } from "@/lib/imageCrop";

const MAX_GALLERY_IMAGES = 3;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
// The original is stored untouched, so allow a generous raw upload —
// a 24 MP phone photo is ~12 MB. Backend caps at 20 MB.
const MAX_COVER_SOURCE_BYTES = 20 * 1024 * 1024;

/**
 * Cover + gallery editor for an event's Media tab. Processing is
 * synchronous server-side (see EventMediaService) — a successful
 * upload response already carries the finished image, so there's no
 * uploading/processing state to poll for here.
 */
export function EventMediaEditor({
  eventId,
  initialEvent,
  disabled,
}: {
  eventId: number;
  initialEvent: Event;
  disabled: boolean;
}) {
  const [event, setEvent] = useState(initialEvent);
  const router = useRouter();
  // Crop modal: `src` (blob: URL for a fresh pick, or the stored original's
  // URL for a re-frame) drives it open; `file` is set only for a fresh pick,
  // so onCropped knows whether to upload or just re-crop server-side.
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropInitial, setCropInitial] = useState<PixelCrop | null>(null);
  // The file picked this session — lets "Adjust crop" re-frame with full
  // pixels even before a reload.
  const [lastOriginal, setLastOriginal] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);

  function handleError(error: Error) {
    if (redirectOnAuthError(error, router)) return;
    notifications.show({
      color: "red",
      message: error instanceof ApiError ? error.message : "Something went wrong.",
    });
  }

  function closeCropModal() {
    if (cropSrc?.startsWith("blob:")) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropFile(null);
    setCropInitial(null);
  }

  const uploadCoverMutation = useMutation({
    mutationFn: ({ file, crop }: { file: File; crop: PixelCrop }) => uploadEventCoverImage(eventId, file, crop),
    onSuccess: (data: { event: Event }) => {
      setEvent(data.event);
      notifications.show({ color: "teal", message: "Cover uploaded." });
    },
    onError: handleError,
  });

  const recropMutation = useMutation({
    mutationFn: (crop: PixelCrop) => recropEventCover(eventId, crop),
    onSuccess: (data: { event: Event }) => {
      setEvent(data.event);
      notifications.show({ color: "teal", message: "Cover crop updated." });
    },
    onError: handleError,
  });

  /**
   * Route a freshly-picked file: reject one that can't make a sharp 16:9
   * cover, upload straight through if it's already landscape-enough, else
   * open the crop modal.
   */
  async function handleCoverFile(file: File) {
    setPreparing(true);
    try {
      const { width, height } = await readImageSize(file);
      const outcome = coverOutcome(width, height);

      if (outcome === "reject") {
        notifications.show({
          color: "red",
          message:
            `This image is too small for an event cover. It's ${width} × ${height} px — ` +
            `aim for 1600 × 900 px or larger so it stays sharp on event pages and when shared.`,
        });
        return;
      }

      setLastOriginal(file);

      if (outcome === "auto") {
        uploadCoverMutation.mutate({ file, crop: centeredCrop(width, height) });
        return;
      }

      setCropFile(file);
      setCropInitial(null);
      setCropSrc(URL.createObjectURL(file));
    } catch (error) {
      handleError(error instanceof Error ? error : new Error("Could not read that image."));
    } finally {
      setPreparing(false);
    }
  }

  function openAdjustCrop() {
    if (lastOriginal) {
      setCropFile(lastOriginal);
      setCropInitial(event.cover_crop);
      setCropSrc(URL.createObjectURL(lastOriginal));
    } else if (event.cover_original_url) {
      // Editor reloaded — re-frame the stored original server-side.
      setCropFile(null);
      setCropInitial(event.cover_crop);
      setCropSrc(event.cover_original_url);
    }
  }

  function handleCropped(rect: PixelCrop) {
    if (cropFile) {
      uploadCoverMutation.mutate({ file: cropFile, crop: rect });
    } else {
      recropMutation.mutate(rect);
    }
    closeCropModal();
  }

  const deleteCoverMutation = useMutation({
    mutationFn: () => deleteEventCoverImage(eventId),
    onSuccess: () => {
      setEvent((prev) => ({ ...prev, cover_image_url: null }));
      notifications.show({ color: "teal", message: "Cover image removed." });
    },
    onError: handleError,
  });

  const uploadGalleryMutation = useMutation({
    mutationFn: (file: File) => uploadEventGalleryImage(eventId, file),
    onSuccess: (data: { event: Event }) => setEvent(data.event),
    onError: handleError,
  });

  const deleteGalleryMutation = useMutation({
    mutationFn: (mediaId: number) => deleteEventGalleryImage(eventId, mediaId),
    onSuccess: (data: { event: Event }) => {
      setEvent(data.event);
      notifications.show({ color: "teal", message: "Image removed." });
    },
    onError: handleError,
  });

  const altTextMutation = useMutation({
    mutationFn: ({ mediaId, altText }: { mediaId: number; altText: string }) =>
      updateEventGalleryImageAltText(eventId, mediaId, altText || null),
    onSuccess: (data: { event: Event }) => setEvent(data.event),
    onError: handleError,
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => reorderEventGallery(eventId, orderedIds),
    onSuccess: (data: { event: Event }) => setEvent(data.event),
    onError: handleError,
  });

  function moveGalleryImage(index: number, direction: -1 | 1) {
    const gallery = [...event.gallery];
    const target = index + direction;
    if (target < 0 || target >= gallery.length) return;
    [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
    reorderMutation.mutate(gallery.map((image) => image.id));
  }

  const gallery = event.gallery;
  const galleryFull = gallery.length >= MAX_GALLERY_IMAGES;

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Text fw={600}>Cover image</Text>
        <Text size="sm" c="dimmed">
          Required before this event can go live. Landscape images work best — you&apos;ll frame the crop before
          publishing.
        </Text>
        {event.cover_image_url ? (
          <Card withBorder radius="lg" p="sm" maw={480}>
            <Image src={event.cover_image_url} radius="md" alt="Event cover" />
            {!disabled && (
              <Group mt="sm" gap="xs">
                {(lastOriginal || event.cover_original_url) && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconCrop size={14} />}
                    loading={preparing || uploadCoverMutation.isPending || recropMutation.isPending}
                    onClick={openAdjustCrop}
                  >
                    Adjust crop
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="light"
                  color="red"
                  loading={deleteCoverMutation.isPending}
                  onClick={() => deleteCoverMutation.mutate()}
                >
                  Remove
                </Button>
              </Group>
            )}
          </Card>
        ) : (
          !disabled && (
            <Dropzone
              onDrop={(files) => files[0] && void handleCoverFile(files[0])}
              onReject={() =>
                notifications.show({ color: "red", message: "That file can't be used as a cover image." })
              }
              maxSize={MAX_COVER_SOURCE_BYTES}
              accept={IMAGE_MIME_TYPE}
              maxFiles={1}
              loading={preparing || uploadCoverMutation.isPending}
              maw={480}
            >
              <Group justify="center" gap="xl" mih={140} style={{ pointerEvents: "none" }}>
                <Dropzone.Accept>
                  <IconUpload size={32} />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX size={32} />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconPhoto size={32} opacity={0.5} />
                </Dropzone.Idle>
                <Stack gap={4} align="center">
                  <Text size="sm">Drag a cover image here, or click to browse</Text>
                  <Text size="xs" c="dimmed">
                    Recommended: 1600 × 900 px or larger · JPG, PNG, WebP · up to 20 MB
                  </Text>
                </Stack>
              </Group>
            </Dropzone>
          )
        )}
      </Stack>

      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600}>Gallery (optional)</Text>
          <Badge variant="light">
            {gallery.length} of {MAX_GALLERY_IMAGES} used
          </Badge>
        </Group>
        <Text size="sm" c="dimmed">
          Up to {MAX_GALLERY_IMAGES} additional images, separate from the cover image above.
        </Text>

        {gallery.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
            {gallery.map((image, index) => (
              <Card key={image.id} withBorder radius="md" p="sm">
                <Stack gap="xs">
                  <Image src={image.thumbnail_url} radius="sm" alt={image.alt_text ?? ""} h={140} />
                  <TextInput
                    size="xs"
                    placeholder="Alt text (optional)"
                    defaultValue={image.alt_text ?? ""}
                    disabled={disabled}
                    onBlur={(event) => {
                      const value = event.currentTarget.value;
                      if (value !== (image.alt_text ?? "")) {
                        altTextMutation.mutate({ mediaId: image.id, altText: value });
                      }
                    }}
                  />
                  {!disabled && (
                    <Group gap={4} justify="space-between">
                      <Group gap={4}>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => moveGalleryImage(index, -1)}
                        >
                          <IconChevronUp size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          disabled={index === gallery.length - 1}
                          onClick={() => moveGalleryImage(index, 1)}
                        >
                          <IconChevronDown size={14} />
                        </ActionIcon>
                      </Group>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => deleteGalleryMutation.mutate(image.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  )}
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {!disabled && !galleryFull && (
          <Dropzone
            onDrop={(files) => files[0] && uploadGalleryMutation.mutate(files[0])}
            onReject={() => notifications.show({ color: "red", message: "That file can't be added to the gallery." })}
            maxSize={MAX_SIZE_BYTES}
            accept={IMAGE_MIME_TYPE}
            maxFiles={1}
            loading={uploadGalleryMutation.isPending}
          >
            <Group justify="center" gap="xl" mih={80} style={{ pointerEvents: "none" }}>
              <IconPhoto size={24} opacity={0.5} />
              <Text size="sm">Drag an image here, or click to browse</Text>
            </Group>
          </Dropzone>
        )}
      </Stack>

      <ImageCropModal
        src={cropSrc}
        initialCrop={cropInitial}
        busy={uploadCoverMutation.isPending || recropMutation.isPending}
        onCancel={closeCropModal}
        onCropped={handleCropped}
      />
    </Stack>
  );
}
