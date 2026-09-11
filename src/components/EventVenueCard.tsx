import { Box, Button, Image, Stack, Text, Title } from "@mantine/core";
import { IconArrowUpRight, IconMap } from "@tabler/icons-react";

/**
 * Real Mapbox static preview when one can be built (a token + venue
 * coordinates); otherwise a tasteful decorative placeholder — same
 * venue name/address either way. The "Get Directions" button is a
 * floating bottom-right overlay on the card either way, per design.
 *
 * `navigationUrl` (when given) is deliberately a Google Maps
 * *directions* deep link (`/maps/dir/`), not the `/maps/search/` link
 * the inline "Preview directions" text next to the date/location uses
 * — that one is a quick glance at where the venue is, this button is
 * a committed action that should open real turn-by-turn navigation,
 * not just drop a pin.
 */
export function EventVenueCard({
  venueName,
  addressLine,
  mapImageUrl,
  navigationUrl,
}: {
  venueName: string;
  addressLine: string | null;
  mapImageUrl: string | null;
  navigationUrl: string | null;
}) {
  return (
    <Stack gap="md" w="100%" maw={700}>
      <Title order={2} fz={{ base: 22, md: 28 }}>
        Venue
      </Title>
      <Box
        pos="relative"
        h={220}
        style={{
          borderRadius: "var(--mantine-radius-lg)",
          overflow: "hidden",
          backgroundColor: mapImageUrl ? undefined : "#f0edfa",
        }}
      >
        {mapImageUrl ? (
          <>
            <Image src={mapImageUrl} alt={`Map showing ${venueName}`} h="100%" fit="cover" />
            {/* Readable over an arbitrary map photo, unlike the placeholder's plain-background text. */}
            <Box
              pos="absolute"
              bottom={0}
              left={0}
              right={0}
              p={16}
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }}
            >
              <Text fw={500} c="white">
                {venueName}
              </Text>
              {addressLine && (
                <Text size="sm" c="gray.3">
                  {addressLine}
                </Text>
              )}
            </Box>
          </>
        ) : (
          // This placeholder's background is deliberately light regardless
          // of site color scheme, so both the icon and text need explicit
          // dark colors — the theme-default resolves to light grey in dark
          // mode and would be unreadable here.
          <Stack align="center" justify="center" gap={8} h="100%" px="xl">
            <IconMap size={36} color="var(--mantine-color-grey-6)" />
            <Text fw={500} ta="center" c="var(--mantine-color-grey-9)">
              {venueName}
            </Text>
            {addressLine && (
              <Text size="sm" ta="center" c="var(--mantine-color-grey-6)">
                {addressLine}
              </Text>
            )}
          </Stack>
        )}
        {navigationUrl && (
          <Button
            component="a"
            href={navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="filled"
            radius="md"
            size="sm"
            pos="absolute"
            bottom={16}
            right={16}
            rightSection={<IconArrowUpRight size={16} />}
          >
            Get Directions
          </Button>
        )}
      </Box>
    </Stack>
  );
}
