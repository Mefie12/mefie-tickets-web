"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Alert, Box, Button, Group, Modal, SimpleGrid, Slider, Stack, Text } from "@mantine/core";
import { COVER_ASPECT, COVER_RECOMMENDED_CROP_WIDTH, type PixelCrop } from "@/lib/imageCrop";

const SOCIAL_ASPECT = 1200 / 630; // ~1.91:1 — wider than 16:9, so a sliver of top/bottom is lost

/** CSS to show the `crop` region of `src` filling a framed box. */
function cropBackground(src: string, crop: PixelCrop, natural: { width: number; height: number }) {
  const spanX = Math.max(1, natural.width - crop.width);
  const spanY = Math.max(1, natural.height - crop.height);
  return {
    backgroundImage: `url(${src})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${(natural.width / crop.width) * 100}% ${(natural.height / crop.height) * 100}%`,
    backgroundPosition: `${(crop.x / spanX) * 100}% ${(crop.y / spanY) * 100}%`,
  } as const;
}

/** The centred SOCIAL_ASPECT slice of a 16:9 `crop`. */
function socialSlice(crop: PixelCrop): PixelCrop {
  const height = crop.width / SOCIAL_ASPECT;
  return { x: crop.x, y: crop.y + (crop.height - height) / 2, width: crop.width, height };
}

export function ImageCropModal({
  src,
  initialCrop,
  busy = false,
  onCancel,
  onCropped,
}: {
  /** Object URL of a freshly-picked file, or the stored original's URL for a re-frame. */
  src: string | null;
  initialCrop?: PixelCrop | null;
  busy?: boolean;
  onCancel: () => void;
  onCropped: (rect: PixelCrop) => void;
}) {
  return (
    <Modal
      opened={src !== null}
      onClose={() => {
        if (!busy) onCancel();
      }}
      title="Adjust your event cover"
      size="lg"
      centered
    >
      {src && (
        <CropBody key={src} src={src} initialCrop={initialCrop ?? null} busy={busy} onCancel={onCancel} onCropped={onCropped} />
      )}
    </Modal>
  );
}

function CropBody({
  src,
  initialCrop,
  busy,
  onCancel,
  onCropped,
}: {
  src: string;
  initialCrop: PixelCrop | null;
  busy: boolean;
  onCancel: () => void;
  onCropped: (rect: PixelCrop) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<PixelCrop | null>(initialCrop);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  const previewRect = pixels ?? initialCrop;
  const canPreview = previewRect && natural;
  const belowRecommended = pixels != null && pixels.width < COVER_RECOMMENDED_CROP_WIDTH;

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Move and zoom the image to choose what appears on your event pages. We generate everything else from this.
      </Text>

      <Box
        pos="relative"
        h={300}
        style={{ background: "var(--mantine-color-dark-8)", borderRadius: "var(--mantine-radius-md)", overflow: "hidden" }}
      >
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          minZoom={1}
          maxZoom={4}
          zoomSpeed={0.2}
          aspect={COVER_ASPECT}
          restrictPosition
          objectFit="contain"
          initialCroppedAreaPixels={initialCrop ?? undefined}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onMediaLoaded={(size) => setNatural({ width: size.naturalWidth, height: size.naturalHeight })}
          onCropComplete={(_: Area, areaPixels: Area) => setPixels(areaPixels)}
        />
      </Box>

      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          Zoom
        </Text>
        <Slider min={1} max={4} step={0.01} value={zoom} onChange={setZoom} label={(v) => `${v.toFixed(1)}×`} />
      </Stack>

      <SimpleGrid cols={2} spacing="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            Event page
          </Text>
          <Box
            style={{
              aspectRatio: "16 / 9",
              borderRadius: "var(--mantine-radius-sm)",
              border: "1px solid var(--mantine-color-default-border)",
              ...(canPreview ? cropBackground(src, previewRect, natural) : { background: "var(--mantine-color-default-hover)" }),
            }}
          />
        </Stack>
        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            Social sharing
          </Text>
          <Box
            style={{
              aspectRatio: "1200 / 630",
              borderRadius: "var(--mantine-radius-sm)",
              border: "1px solid var(--mantine-color-default-border)",
              ...(canPreview
                ? cropBackground(src, socialSlice(previewRect), natural)
                : { background: "var(--mantine-color-default-hover)" }),
            }}
          />
        </Stack>
      </SimpleGrid>

      {belowRecommended && pixels && (
        <Alert color="yellow" variant="light" p="xs">
          <Text size="xs">
            This crop is {Math.round(pixels.width)}px wide. It can be used, but a larger image will look sharper on
            big screens and in link previews.
          </Text>
        </Alert>
      )}

      <Group justify="flex-end">
        <Button variant="default" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button loading={busy} disabled={!pixels} onClick={() => pixels && onCropped(pixels)}>
          Use this crop
        </Button>
      </Group>
    </Stack>
  );
}
