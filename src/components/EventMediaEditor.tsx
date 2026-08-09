"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { ActionIcon, Badge, Button, Card, Group, Image, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconPhoto, IconTrash, IconUpload, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import type { Event } from "@/lib/eventApi";
import {
  deleteEventCoverImage,
  deleteEventGalleryImage,
  reorderEventGallery,
  updateEventGalleryImageAltText,
  uploadEventCoverImage,
  uploadEventGalleryImage,
} from "@/lib/eventMediaApi";

const MAX_GALLERY_IMAGES = 3;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

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

  function handleError(error: Error) {
    if (redirectOnAuthError(error, router)) return;
    notifications.show({
      color: "red",
      message: error instanceof ApiError ? error.message : "Something went wrong.",
    });
  }

  const uploadCoverMutation = useMutation({
    mutationFn: (file: File) => uploadEventCoverImage(eventId, file),
    onSuccess: (data: { event: Event }) => {
      setEvent(data.event);
      notifications.show({ color: "teal", message: "Cover image uploaded." });
    },
    onError: handleError,
  });

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
          Required before this event can go live. Used on listing cards, search results, and the event page. Min
          1200×675, 16:9 recommended, JPEG/PNG/WebP, up to 5MB.
        </Text>
        {event.cover_image_url ? (
          <Card withBorder radius="lg" p="sm" maw={480}>
            <Image src={event.cover_image_url} radius="md" alt="Event cover" />
            {!disabled && (
              <Button
                mt="sm"
                size="xs"
                variant="light"
                color="red"
                loading={deleteCoverMutation.isPending}
                onClick={() => deleteCoverMutation.mutate()}
                style={{ alignSelf: "flex-start" }}
              >
                Remove cover image
              </Button>
            )}
          </Card>
        ) : (
          !disabled && (
            <Dropzone
              onDrop={(files) => files[0] && uploadCoverMutation.mutate(files[0])}
              onReject={() =>
                notifications.show({ color: "red", message: "That file can't be used as a cover image." })
              }
              maxSize={MAX_SIZE_BYTES}
              accept={IMAGE_MIME_TYPE}
              maxFiles={1}
              loading={uploadCoverMutation.isPending}
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
                    JPEG, PNG, or WebP · min 1200×675 · up to 5MB
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
    </Stack>
  );
}
