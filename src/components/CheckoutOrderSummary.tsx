import { Group, Stack, Text, Title } from "@mantine/core";
import { IconCalendar, IconMapPin, IconWorld } from "@tabler/icons-react";
import type { Order } from "@/lib/checkoutApi";
import { formatEventDateRange } from "@/lib/eventDateTime";
import type { PublicEvent } from "@/lib/publicEventApi";
import { OrderSummaryCard, type OrderSummaryLine } from "@/components/OrderSummaryCard";

/**
 * The checkout page's persistent Order Summary panel — event identity
 * (title/date/location) above the existing per-line-item OrderSummaryCard,
 * per the Figma checkout mock. Reuses OrderSummaryCard unchanged for the
 * line-items/total part rather than re-deriving that display.
 */
export function CheckoutOrderSummary({
  event,
  lines,
}: {
  event: PublicEvent;
  lines: { order: Order } | { lines: OrderSummaryLine[] };
}) {
  const showVenue = event.location?.location_type === "IN_PERSON" || event.location?.location_type === "HYBRID";
  const showOnline = event.location?.location_type === "ONLINE" || event.location?.location_type === "HYBRID";
  const venueLabel = [event.location?.venue_name, event.location?.city, event.location?.state].filter(Boolean).join(", ");

  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Title order={3} fz={18} style={{ overflowWrap: "anywhere" }}>
          {event.title}
        </Title>
        <Group gap={6}>
          <IconCalendar size={16} />
          <Text size="sm" c="dimmed">
            {formatEventDateRange(event.start_date, event.end_date, event.timezone)}
          </Text>
        </Group>
        {showVenue && venueLabel && (
          <Group gap={6}>
            <IconMapPin size={16} />
            <Text size="sm" c="dimmed">
              {venueLabel}
            </Text>
          </Group>
        )}
        {showOnline && (
          <Group gap={6}>
            <IconWorld size={16} />
            <Text size="sm" c="dimmed">
              Online event{event.location?.platform_name ? ` · ${event.location.platform_name}` : ""}
            </Text>
          </Group>
        )}
      </Stack>
      {"order" in lines ? (
        <OrderSummaryCard order={lines.order} />
      ) : (
        <OrderSummaryCard lines={lines.lines} currency={event.currency_code} />
      )}
    </Stack>
  );
}
