"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconPlus, IconTicket, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { utcIsoToZonedPartsOrEmpty } from "@/lib/eventDateTime";
import { createProduct, type PricingType, type Product, type TicketOptionInput, updateProduct } from "@/lib/productApi";
import { currencySymbol, formatMoney } from "@/lib/money";

/** Mantine gives nested-list validators a path like "tiers.2.ends_at_time". */
function tierIndexFromPath(path: string): number {
  return Number(path.split(".")[1]);
}

type TierFormValue = {
  id: number | null;
  name: string;
  // NumberInput's onChange hands back a number once edited (never a
  // string), even though its *initial* value can be seeded as either —
  // "" is the only valid empty state, never "" AND a numeric string.
  price: number | "";
  // Wall-clock parts, read/written in the parent EVENT's timezone — the
  // server resolves them to instants. "" means "no window set".
  starts_at_date: string;
  starts_at_time: string;
  ends_at_date: string;
  ends_at_time: string;
  quantity_available: number | "";
  is_enabled: boolean;
  // Caps how many attendees one order may register for this specific
  // tier — independent of the product's own cap below. "" = unlimited.
  max_attendees_per_registration: number | "";
};

type ProductFormValues = {
  title: string;
  type: PricingType;
  price: number | "";
  quantity_available: number | "";
  // Caps how many attendees one order may register for this product —
  // meaningless (and not rendered) for TIERED, which uses each tier's
  // own field instead. "" = unlimited.
  max_attendees_per_registration: number | "";
  // Wall-clock parts, read/written in the parent EVENT's timezone — same
  // pattern as a tier's own window (see TierFormValue). "" means "no
  // window set" for that side.
  starts_at_date: string;
  starts_at_time: string;
  ends_at_date: string;
  ends_at_time: string;
  is_enabled: boolean;
  tiers: TierFormValue[];
};

const PRICING_OPTIONS: { value: PricingType; label: string }[] = [
  { value: "REGISTRATION", label: "Free (requires registration)" },
  { value: "PAID", label: "Paid (single price)" },
  { value: "TIERED", label: "Ticket group with options" },
];

/** REGISTRATION is the only creatable $0 ticket type — every free ticket requires registration. */
const RECOGNIZED_TYPES: PricingType[] = ["TIERED", "FREE", "REGISTRATION", "PAID"];

/**
 * Null (not 0) when there are no enabled tiers, or any enabled tier is
 * itself uncapped — an unlimited tier makes the sum meaningless, same
 * rule the server applies (see ProductService::assertTierThresholdsFitTotal).
 */
function enabledTierQuantitySum(tiers: TierFormValue[]): number | null {
  const enabled = tiers.filter((t) => t.is_enabled);
  if (enabled.length === 0 || enabled.some((t) => t.quantity_available === "")) return null;
  return enabled.reduce((total, t) => total + (t.quantity_available === "" ? 0 : t.quantity_available), 0);
}

function emptyTier(): TierFormValue {
  return {
    id: null,
    name: "",
    price: "",
    starts_at_date: "",
    starts_at_time: "",
    ends_at_date: "",
    ends_at_time: "",
    quantity_available: "",
    is_enabled: true,
    max_attendees_per_registration: "",
  };
}

function productToFormValues(product: Product | undefined, eventTimezone: string): ProductFormValues {
  if (!product) {
    return {
      title: "",
      type: "PAID",
      price: "",
      quantity_available: "",
      max_attendees_per_registration: "",
      starts_at_date: "",
      starts_at_time: "",
      ends_at_date: "",
      ends_at_time: "",
      is_enabled: true,
      tiers: [emptyTier()],
    };
  }
  const startsAt = utcIsoToZonedPartsOrEmpty(product.starts_at, eventTimezone);
  const endsAt = utcIsoToZonedPartsOrEmpty(product.ends_at, eventTimezone);
  return {
    title: product.title,
    type: RECOGNIZED_TYPES.includes(product.type) ? product.type : "PAID",
    price: product.price !== null ? Number(product.price) : "",
    quantity_available: product.quantity_available !== null ? product.quantity_available : "",
    max_attendees_per_registration:
      product.max_attendees_per_registration !== null ? product.max_attendees_per_registration : "",
    starts_at_date: startsAt.date,
    starts_at_time: startsAt.time,
    ends_at_date: endsAt.date,
    ends_at_time: endsAt.time,
    is_enabled: product.disabled_at === null,
    tiers:
      product.price_tiers.length > 0
        ? product.price_tiers.map((t) => {
            const startsAt = utcIsoToZonedPartsOrEmpty(t.starts_at, eventTimezone);
            const endsAt = utcIsoToZonedPartsOrEmpty(t.ends_at, eventTimezone);
            return {
              id: t.id,
              name: t.name,
              price: Number(t.price),
              starts_at_date: startsAt.date,
              starts_at_time: startsAt.time,
              ends_at_date: endsAt.date,
              ends_at_time: endsAt.time,
              quantity_available: t.quantity_available,
              is_enabled: t.is_enabled,
              max_attendees_per_registration:
                t.max_attendees_per_registration !== null ? t.max_attendees_per_registration : "",
            };
          })
        : [emptyTier()],
  };
}

export function ProductsEditor({
  eventId,
  eventTimezone,
  eventCurrency,
  initialProducts,
  disabled,
}: {
  eventId: number;
  eventTimezone: string;
  eventCurrency: string;
  initialProducts: Product[];
  disabled: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [modalProduct, setModalProduct] = useState<Product | "new" | null>(null);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Ticket types buyers can choose from at checkout.
        </Text>
        {!disabled && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModalProduct("new")}>
            Add ticket type
          </Button>
        )}
      </Group>

      {products.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Stack align="center" gap="xs" py="lg">
            <IconTicket size={32} opacity={0.5} />
            <Text c="dimmed" ta="center">
              No ticket types yet. Add one to let people buy tickets.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack gap="sm">
          {products.map((product) => (
            <Card key={product.id} withBorder radius="lg" p="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Group gap="xs">
                    <Text fw={600}>{product.title}</Text>
                    <Badge size="sm" variant="light">
                      {product.type}
                    </Badge>
                    {product.is_sold_out && (
                      <Badge size="sm" color="red" variant="light">
                        Sold out
                      </Badge>
                    )}
                    {!product.is_on_sale && !product.is_sold_out && (
                      <Badge size="sm" color="gray" variant="light">
                        {product.disabled_at ? "Paused" : "Not on sale"}
                      </Badge>
                    )}
                  </Group>
                  <Text size="sm" c="dimmed">
                    {productSummary(product, eventCurrency)}
                  </Text>
                </Stack>
                {!disabled && (
                  <Button size="xs" variant="light" onClick={() => setModalProduct(product)}>
                    Edit
                  </Button>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {modalProduct !== null && (
        <ProductFormModal
          eventId={eventId}
          eventTimezone={eventTimezone}
          eventCurrency={eventCurrency}
          product={modalProduct === "new" ? undefined : modalProduct}
          onClose={() => setModalProduct(null)}
          onSaved={(saved) => {
            setProducts((prev) => {
              const exists = prev.some((p) => p.id === saved.id);
              return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
            });
            setModalProduct(null);
          }}
        />
      )}
    </Stack>
  );
}

function productSummary(product: Product, currencyCode: string): string {
  if (product.type === "REGISTRATION" || product.type === "FREE") {
    const label = product.type === "REGISTRATION" ? "Free · registration required" : "Free (legacy)";
    return product.quantity_available !== null
      ? `${label} · ${product.quantity_remaining} of ${product.quantity_available} left`
      : `${label} · unlimited`;
  }
  if (product.type === "TIERED") {
    const count = product.price_tiers.filter((t) => t.is_enabled).length;
    const currently = product.current_price ? ` · currently ${formatMoney(product.current_price, currencyCode)}` : "";
    return `${count} active option${count === 1 ? "" : "s"}${currently}`;
  }
  const price = formatMoney(product.price, currencyCode);
  return product.quantity_available !== null
    ? `${price} · ${product.quantity_remaining} of ${product.quantity_available} left`
    : `${price} · unlimited`;
}

function ProductFormModal({
  eventId,
  eventTimezone,
  eventCurrency,
  product,
  onClose,
  onSaved,
}: {
  eventId: number;
  eventTimezone: string;
  eventCurrency: string;
  product?: Product;
  onClose: () => void;
  onSaved: (product: Product) => void;
}) {
  const isEdit = product !== undefined;

  const router = useRouter();

  const form = useForm<ProductFormValues>({
    initialValues: productToFormValues(product, eventTimezone),
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      price: (v, values) => (values.type === "PAID" && v === "" ? "Price is required" : null),
      starts_at_time: (v, values) =>
        Boolean(values.starts_at_date) !== Boolean(v) ? "Set both a date and a time, or neither" : null,
      ends_at_time: (v, values) => {
        if (Boolean(values.ends_at_date) !== Boolean(v)) return "Set both a date and a time, or neither";
        if (values.starts_at_date && values.ends_at_date && `${values.ends_at_date} ${v}` <= `${values.starts_at_date} ${values.starts_at_time}`) {
          return "Must end after it starts";
        }
        return null;
      },
      quantity_available: (v, values) => {
        if (values.type !== "TIERED") return null;
        if (v === "") return "Ticket group capacity is required.";
        const enabledTiers = values.tiers.filter((t) => t.is_enabled);
        if (enabledTiers.some((t) => t.quantity_available === "")) return "Every enabled option needs a capacity.";
        const sum = enabledTiers.reduce((total, t) => total + (t.quantity_available === "" ? 0 : t.quantity_available), 0);
        return sum > v ? `The enabled options' combined capacity (${sum}) exceeds this group capacity (${v}).` : null;
      },
      tiers: {
        name: (v, values, path) =>
          values.type === "TIERED" && path.startsWith("tiers") && v.trim().length === 0 ? "Name is required" : null,
        price: (v, values) => (values.type === "TIERED" && v === "" ? "Price is required" : null),
        quantity_available: (v, values) => (values.type === "TIERED" && v === "" ? "Capacity is required" : null),
        // A date without its time is meaningless — the server rejects it,
        // so catch it here rather than round-tripping a 422.
        starts_at_time: (v, values, path) => {
          const tier = values.tiers[tierIndexFromPath(path)];
          return tier && Boolean(tier.starts_at_date) !== Boolean(v) ? "Set both a date and a time, or neither" : null;
        },
        ends_at_time: (v, values, path) => {
          const tier = values.tiers[tierIndexFromPath(path)];
          if (!tier) return null;
          if (Boolean(tier.ends_at_date) !== Boolean(v)) return "Set both a date and a time, or neither";
          if (tier.starts_at_date && tier.ends_at_date && `${tier.ends_at_date} ${v}` <= `${tier.starts_at_date} ${tier.starts_at_time}`) {
            return "Must end after it starts";
          }
          return null;
        },
      },
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const input = {
        title: values.title,
        type: values.type,
        price: values.type === "PAID" && values.price !== "" ? values.price : null,
        quantity_available: values.quantity_available === "" ? null : values.quantity_available,
        max_attendees_per_registration:
          values.max_attendees_per_registration === "" ? null : values.max_attendees_per_registration,
        // Forwarded as typed; the server resolves them against the
        // event's timezone. No client-side conversion.
        starts_at_date: values.starts_at_date || null,
        starts_at_time: values.starts_at_time || null,
        ends_at_date: values.ends_at_date || null,
        ends_at_time: values.ends_at_time || null,
        is_enabled: values.is_enabled,
        tiers:
          values.type === "TIERED"
            ? values.tiers.map(
                (t, index): TicketOptionInput => ({
                  id: t.id,
                  name: t.name,
                  sort_order: index,
                  price: t.price === "" ? 0 : t.price,
                  // Forwarded as typed; the server resolves them against
                  // the event's timezone. No client-side conversion.
                  starts_at_date: t.starts_at_date || null,
                  starts_at_time: t.starts_at_time || null,
                  ends_at_date: t.ends_at_date || null,
                  ends_at_time: t.ends_at_time || null,
                  quantity_available: t.quantity_available === "" ? 0 : t.quantity_available,
                  is_enabled: t.is_enabled,
                  max_attendees_per_registration:
                    t.max_attendees_per_registration === "" ? null : t.max_attendees_per_registration,
                }),
              )
            : undefined,
      };
      return isEdit ? updateProduct(eventId, product.id, input) : createProduct(eventId, input);
    },
    onSuccess: (data: { product: Product }) => {
      onSaved(data.product);
      notifications.show({ color: "teal", message: isEdit ? "Ticket type updated." : "Ticket type added." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        const flat = Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]]));
        form.setErrors(flat);
        if (flat.tiers) {
          notifications.show({ color: "red", message: flat.tiers });
        }
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  const tiers = form.values.tiers;

  return (
    <Modal opened onClose={onClose} title={isEdit ? "Edit ticket type" : "Add ticket type"} size="lg">
      <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
        <Stack>
          <Select
            label="Pricing type"
            data={
              product?.type === "FREE"
                ? [{ value: "FREE", label: "Free (legacy)", disabled: true }, ...PRICING_OPTIONS]
                : PRICING_OPTIONS
            }
            allowDeselect={false}
            {...form.getInputProps("type")}
          />
          <TextInput label="Title" placeholder="General Admission" {...form.getInputProps("title")} />

          {form.values.type === "REGISTRATION" && (
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Requires registration:
              </Text>
              <Badge color="teal" variant="light">
                Yes
              </Badge>
            </Group>
          )}

          {form.values.type === "PAID" && (
            <NumberInput
              label="Price"
              prefix={currencySymbol(eventCurrency)}
              min={0}
              decimalScale={2}
              {...form.getInputProps("price")}
            />
          )}

          <NumberInput
            label="Total quantity available"
            description="Leave blank for unlimited"
            min={0}
            {...form.getInputProps("quantity_available")}
          />
          {form.values.type === "TIERED" && enabledTierQuantitySum(tiers) !== null && (
            <Text size="xs" c="dimmed">
              Enabled tiers currently add up to {enabledTierQuantitySum(tiers)} tickets.
            </Text>
          )}

          {form.values.type !== "TIERED" && (
            <NumberInput
              label="Max attendees per registration"
              description="Leave blank for unlimited"
              min={1}
              {...form.getInputProps("max_attendees_per_registration")}
            />
          )}

          <Divider label="Sale window & availability" labelPosition="left" mt="sm" />
          <Text size="xs" c="dimmed">
            Times are in {eventTimezone}, this event&apos;s timezone.
            {form.values.type === "TIERED" && " Applies on top of each tier's own window below."}
          </Text>
          <Group grow align="flex-start">
            <TextInput type="date" label="Starts (optional)" {...form.getInputProps("starts_at_date")} />
            <TextInput type="time" label="At" {...form.getInputProps("starts_at_time")} />
          </Group>
          <Group grow align="flex-start">
            <TextInput type="date" label="Ends (optional)" {...form.getInputProps("ends_at_date")} />
            <TextInput type="time" label="At" {...form.getInputProps("ends_at_time")} />
          </Group>
          <Switch label="Enabled" {...form.getInputProps("is_enabled", { type: "checkbox" })} />

          {form.values.type === "TIERED" && (
            <>
              <Divider label="Tiers" labelPosition="left" mt="sm" />
              {tiers.map((tier, index) => (
                <Card key={index} withBorder radius="md" p="sm">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="sm" fw={600}>
                        Tier {index + 1}
                      </Text>
                      <Group gap={4}>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          disabled={index === 0}
                          onClick={() => form.reorderListItem("tiers", { from: index, to: index - 1 })}
                        >
                          <IconChevronUp size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          disabled={index === tiers.length - 1}
                          onClick={() => form.reorderListItem("tiers", { from: index, to: index + 1 })}
                        >
                          <IconChevronDown size={14} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          disabled={tiers.length === 1}
                          onClick={() => form.removeListItem("tiers", index)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>
                    <TextInput
                      label="Name"
                      placeholder="Early Bird"
                      {...form.getInputProps(`tiers.${index}.name`)}
                    />
                    <NumberInput
                      label="Price"
                      prefix={currencySymbol(eventCurrency)}
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps(`tiers.${index}.price`)}
                    />
                    <Text size="xs" c="dimmed">
                      Sale window times are in {eventTimezone}, this event&apos;s timezone.
                    </Text>
                    <Group grow align="flex-start">
                      <TextInput
                        type="date"
                        label="Starts (optional)"
                        {...form.getInputProps(`tiers.${index}.starts_at_date`)}
                      />
                      <TextInput type="time" label="At" {...form.getInputProps(`tiers.${index}.starts_at_time`)} />
                    </Group>
                    <Group grow align="flex-start">
                      <TextInput
                        type="date"
                        label="Ends (optional)"
                        {...form.getInputProps(`tiers.${index}.ends_at_date`)}
                      />
                      <TextInput type="time" label="At" {...form.getInputProps(`tiers.${index}.ends_at_time`)} />
                    </Group>
                    <NumberInput
                      label="Option capacity"
                      description="Required. You can increase it later within the ticket group capacity."
                      min={0}
                      {...form.getInputProps(`tiers.${index}.quantity_available`)}
                    />
                    <NumberInput
                      label="Max attendees per registration"
                      description="Leave blank for unlimited — e.g. cap Early Bird at 1 per order, leave Regular uncapped"
                      min={1}
                      {...form.getInputProps(`tiers.${index}.max_attendees_per_registration`)}
                    />
                    <Switch
                      label="Enabled"
                      {...form.getInputProps(`tiers.${index}.is_enabled`, { type: "checkbox" })}
                    />
                  </Stack>
                </Card>
              ))}
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => form.insertListItem("tiers", emptyTier())}
                style={{ alignSelf: "flex-start" }}
              >
                Add ticket option
              </Button>
            </>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {isEdit ? "Save changes" : "Add ticket type"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
