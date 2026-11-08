"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { useMediaQuery } from "@mantine/hooks";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Menu,
  Modal,
  NumberInput,
  Popover,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconInfoCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconStack2,
  IconTicket,
  IconTrash,
  IconUserCheck,
} from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { TicketDescriptionEditor, TICKET_DESCRIPTION_MAX_LENGTH } from "@/components/TicketDescriptionEditor";
import { BundlesEditor } from "@/components/BundlesEditor";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { utcIsoToZonedPartsOrEmpty } from "@/lib/eventDateTime";
import {
  describeSaleWindow,
  hasSaleWindow,
  MoreSettings,
  SaleWindowFields,
  type WindowParts,
} from "@/components/TicketFormParts";
import {
  createProduct,
  deleteProduct,
  type PricingType,
  type Product,
  type TicketOptionInput,
  updateProduct,
} from "@/lib/productApi";
import { currencySymbol, formatMoney, currencyExponent } from "@/lib/money";

/** Mantine gives nested-list validators a path like "tiers.2.ends_at_time". */
function tierIndexFromPath(path: string): number {
  return Number(path.split(".")[1]);
}

type TierFormValue = {
  /** Stable client key, so reordering/removing options keeps each card's own open/closed state. */
  uid: string;
  id: number | null;
  name: string;
  // Optional light rich text; "" = none (sent as null).
  description: string;
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
  // Hidden from the ticket list; sold only inside bundles.
  bundle_only: boolean;
  // Caps how many attendees one order may register for this specific
  // tier — independent of the product's own cap below. "" = unlimited.
  max_attendees_per_registration: number | "";
};

type ProductFormValues = {
  title: string;
  description: string;
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
  bundle_only: boolean;
  tiers: TierFormValue[];
};

/** What each creatable ticket type means, for the "Add ticket type" menu and the form header. */
const TYPE_META: Record<"PAID" | "REGISTRATION" | "TIERED", { label: string; description: string; icon: typeof IconTicket }> = {
  PAID: { label: "Paid ticket", description: "One price for everyone", icon: IconTicket },
  REGISTRATION: { label: "Free ticket", description: "No payment — attendees register", icon: IconUserCheck },
  TIERED: { label: "Ticket group with options", description: "Early bird, VIP, student… each with its own price", icon: IconStack2 },
};
const CREATABLE_TYPES = ["PAID", "REGISTRATION", "TIERED"] as const;

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
    uid: crypto.randomUUID(),
    id: null,
    name: "",
    description: "",
    price: "",
    starts_at_date: "",
    starts_at_time: "",
    ends_at_date: "",
    ends_at_time: "",
    quantity_available: "",
    is_enabled: true,
    bundle_only: false,
    max_attendees_per_registration: "",
  };
}

function HelpFieldLabel({
  htmlFor,
  children,
  help,
  required,
}: {
  htmlFor: string;
  children: ReactNode;
  help: ReactNode;
  required?: boolean;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <Group gap={4} wrap="nowrap">
      <Text component="label" htmlFor={htmlFor} size="sm" fw={500}>
        {children}
        {required && (
          <Text component="span" c="var(--mantine-color-error)" aria-hidden="true">
            {" "}
            *
          </Text>
        )}
      </Text>
      <Popover
        opened={opened}
        onChange={setOpened}
        position="bottom-start"
        width="min(320px, calc(100vw - 32px))"
        withinPortal
        closeOnClickOutside
        closeOnEscape
        middlewares={{ flip: true, shift: true }}
      >
        <Popover.Target>
          <ActionIcon
            type="button"
            variant="subtle"
            color="gray"
            size="xs"
            aria-label={`More information about ${String(children).toLowerCase()}`}
            aria-expanded={opened}
            aria-haspopup="dialog"
            onClick={() => setOpened((current) => !current)}
          >
            <IconInfoCircle size={15} aria-hidden="true" />
          </ActionIcon>
        </Popover.Target>
        <Popover.Dropdown>
          <Text size="sm">{help}</Text>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}

function productToFormValues(product: Product | undefined, eventTimezone: string, newType: PricingType = "PAID"): ProductFormValues {
  if (!product) {
    return {
      title: "",
      description: "",
      type: newType,
      price: "",
      quantity_available: "",
      max_attendees_per_registration: "",
      starts_at_date: "",
      starts_at_time: "",
      ends_at_date: "",
      ends_at_time: "",
      is_enabled: true,
      bundle_only: false,
      tiers: [emptyTier()],
    };
  }
  const startsAt = utcIsoToZonedPartsOrEmpty(product.starts_at, eventTimezone);
  const endsAt = utcIsoToZonedPartsOrEmpty(product.ends_at, eventTimezone);
  return {
    title: product.title,
    description: product.description ?? "",
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
    bundle_only: product.bundle_only ?? false,
    tiers:
      product.price_tiers.length > 0
        ? product.price_tiers.map((t) => {
            const startsAt = utcIsoToZonedPartsOrEmpty(t.starts_at, eventTimezone);
            const endsAt = utcIsoToZonedPartsOrEmpty(t.ends_at, eventTimezone);
            return {
              uid: crypto.randomUUID(),
              id: t.id,
              name: t.name,
              description: t.description ?? "",
              price: Number(t.price),
              starts_at_date: startsAt.date,
              starts_at_time: startsAt.time,
              ends_at_date: endsAt.date,
              ends_at_time: endsAt.time,
              quantity_available: t.quantity_available,
              is_enabled: t.is_enabled,
              bundle_only: t.bundle_only ?? false,
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
  bundlesEnabled = false,
}: {
  eventId: number;
  eventTimezone: string;
  eventCurrency: string;
  initialProducts: Product[];
  disabled: boolean;
  bundlesEnabled?: boolean;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  // A product being edited, or { newType } when adding one (the type is chosen from the menu first).
  const [modalProduct, setModalProduct] = useState<Product | { newType: PricingType } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (productId: number) => deleteProduct(eventId, productId),
    onSuccess: (_data, productId) => {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      notifications.show({ color: "teal", message: "Ticket type deleted." });
    },
    onError: (error: Error, productId) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.status === 404) {
        // Already deleted elsewhere (e.g. a stale second tab) — the
        // outcome is the same as a successful delete from here.
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        notifications.show({ color: "yellow", message: "This ticket type was already deleted." });
        return;
      }
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Something went wrong.",
      });
    },
  });

  function openDeleteModal(product: Product) {
    modals.openConfirmModal({
      title: `Delete "${product.title}"?`,
      centered: true,
      children: <Text size="sm">This permanently removes this unused ticket type. This cannot be undone.</Text>,
      labels: { confirm: "Delete ticket type", cancel: "Cancel" },
      confirmProps: { color: "red", loading: deleteMutation.isPending },
      onConfirm: () => deleteMutation.mutate(product.id),
    });
  }

  const toggleEnabledMutation = useMutation({
    mutationFn: (product: Product) =>
      updateProduct(eventId, product.id, { is_enabled: product.disabled_at !== null }),
    onSuccess: (data: { product: Product }) => {
      setProducts((prev) => prev.map((p) => (p.id === data.product.id ? data.product : p)));
      notifications.show({
        color: "teal",
        message: data.product.disabled_at ? "Ticket type paused." : "Ticket type resumed.",
      });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({
        color: "red",
        message: error instanceof ApiError ? error.message : "Something went wrong.",
      });
    },
  });

  // UI hint only — does not determine server-side deletion eligibility.
  // quantity_sold + quantity_reserved + quantity_complimentary_held === 0
  // does NOT imply the product has never had historical usage: it can be
  // sold out, refunded, and voided back down to zero on every counter and
  // still be permanently undeletable server-side. This just means there's
  // nothing to warn about *right now* — a 422 on delete remains a
  // legitimate, expected outcome even when this hint leaves Delete enabled.
  function hasUsageHint(product: Product): boolean {
    return product.quantity_sold + product.quantity_reserved + product.quantity_complimentary_held > 0;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Ticket types buyers can choose from at checkout.
        </Text>
        {!disabled && (
          <Menu position="bottom-end" shadow="md" width={290} radius="md" offset={6}>
            <Menu.Target>
              <Button size="xs" leftSection={<IconPlus size={14} />} rightSection={<IconChevronDown size={14} />}>
                Add ticket type
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {CREATABLE_TYPES.map((type) => {
                const meta = TYPE_META[type];
                return (
                  <Menu.Item key={type} leftSection={<meta.icon size={18} />} py={8} onClick={() => setModalProduct({ newType: type })}>
                    <Text size="sm" fw={600}>{meta.label}</Text>
                    <Text size="xs" c="dimmed">{meta.description}</Text>
                  </Menu.Item>
                );
              })}
            </Menu.Dropdown>
          </Menu>
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
                    {(product.bundle_only || (product.type === "TIERED" && product.price_tiers.length > 0 && product.price_tiers.every((t) => t.bundle_only))) && (
                      <Badge size="sm" color="grape" variant="light">
                        Bundles only
                      </Badge>
                    )}
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
                  <Group gap="xs">
                    <Button size="xs" variant="light" onClick={() => setModalProduct(product)}>
                      Edit
                    </Button>
                    <Tooltip label={product.disabled_at ? "Resume sales" : "Pause sales"}>
                      <ActionIcon
                        size="lg"
                        variant="light"
                        color="gray"
                        aria-label={product.disabled_at ? "Resume ticket type" : "Pause ticket type"}
                        loading={toggleEnabledMutation.isPending && toggleEnabledMutation.variables?.id === product.id}
                        onClick={() => toggleEnabledMutation.mutate(product)}
                      >
                        {product.disabled_at ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip
                      label="This ticket type has existing activity. Disable it instead."
                      disabled={!hasUsageHint(product)}
                    >
                      <ActionIcon
                        size="lg"
                        variant="light"
                        color="red"
                        aria-label="Delete ticket type"
                        disabled={hasUsageHint(product)}
                        onClick={() => openDeleteModal(product)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
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
          product={"newType" in modalProduct ? undefined : modalProduct}
          newType={"newType" in modalProduct ? modalProduct.newType : undefined}
          bundlesEnabled={bundlesEnabled}
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

      {bundlesEnabled && (
        <BundlesEditor eventId={eventId} eventCurrency={eventCurrency} eventTimezone={eventTimezone} products={products} disabled={disabled} />
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
  newType,
  onClose,
  onSaved,
  bundlesEnabled = false,
}: {
  eventId: number;
  eventTimezone: string;
  eventCurrency: string;
  product?: Product;
  /** The type picked from the "Add ticket type" menu (create only). */
  newType?: PricingType;
  onClose: () => void;
  onSaved: (product: Product) => void;
  bundlesEnabled?: boolean;
}) {
  const isEdit = product !== undefined;
  const isMobile = useMediaQuery("(max-width: 36em)");

  const router = useRouter();

  const form = useForm<ProductFormValues>({
    initialValues: productToFormValues(product, eventTimezone, newType),
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      // Optional: only a length check, never "required".
      description: (v) => (v.length > TICKET_DESCRIPTION_MAX_LENGTH ? "Description is too long." : null),
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
        if (v !== "" && v < 0) return "Capacity cannot be negative.";
        if (values.type !== "TIERED") return null;
        if (v === "") return "Ticket group capacity is required.";
        const enabledTiers = values.tiers.filter((t) => t.is_enabled);
        if (enabledTiers.some((t) => t.quantity_available === "")) return "Every enabled option needs a capacity.";
        const sum = enabledTiers.reduce((total, t) => total + (t.quantity_available === "" ? 0 : t.quantity_available), 0);
        return sum > v ? `The enabled options' combined capacity (${sum}) exceeds this group capacity (${v}).` : null;
      },
      tiers: {
        description: (v) => (v.length > TICKET_DESCRIPTION_MAX_LENGTH ? "Description is too long." : null),
        name: (v, values, path) =>
          values.type === "TIERED" && path.startsWith("tiers") && v.trim().length === 0 ? "Name is required" : null,
        price: (v, values) => (values.type === "TIERED" && v === "" ? "Price is required" : null),
        quantity_available: (v, values) => {
          if (v !== "" && v < 0) return "Capacity cannot be negative.";
          return values.type === "TIERED" && v === "" ? "Capacity is required" : null;
        },
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

  const productWindow = (v: ProductFormValues): WindowParts => ({
    starts_at_date: v.starts_at_date, starts_at_time: v.starts_at_time, ends_at_date: v.ends_at_date, ends_at_time: v.ends_at_time,
  });

  // "More settings" start closed so the form stays short — but open straight away when editing a
  // ticket that already customises something, and whenever an error lands inside one.
  // A group keeps its description and Enabled switch in here, so a description or a paused group counts as customised.
  const productCustomised = (v: ProductFormValues) =>
    v.type === "TIERED"
      ? v.description.trim() !== "" || !v.is_enabled || hasSaleWindow(productWindow(v))
      : v.max_attendees_per_registration !== "" || v.bundle_only || hasSaleWindow(productWindow(v));
  const tierCustomised = (t: TierFormValue) =>
    t.max_attendees_per_registration !== "" || t.bundle_only || hasSaleWindow(t);

  const [moreOpen, setMoreOpen] = useState(() => isEdit && productCustomised(form.values));
  const [openOptions, setOpenOptions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(form.values.tiers.filter((t) => isEdit && tierCustomised(t)).map((t) => [t.uid, true])),
  );

  /** Open whichever collapsed section holds a field that has an error. */
  const revealErrors = (errors: Record<string, unknown>) => {
    const inMore = /(^|\.)(max_attendees_per_registration|starts_at_(date|time)|ends_at_(date|time))$/;
    for (const key of Object.keys(errors)) {
      const tier = key.match(/^tiers\.(\d+)\.(.+)$/);
      if (tier) {
        const uid = form.values.tiers[Number(tier[1])]?.uid;
        if (uid && inMore.test(tier[2])) setOpenOptions((current) => ({ ...current, [uid]: true }));
      } else if (inMore.test(key) || (key === "description" && form.values.type === "TIERED")) {
        setMoreOpen(true);
      }
    }
  };

  const summarize = (max: number | "", window: WindowParts, bundleOnly: boolean, showMax: boolean) =>
    [
      showMax ? (max === "" ? "No per-order limit" : `Up to ${max} per order`) : null,
      describeSaleWindow(window),
      bundleOnly ? "Bundles only" : null,
    ].filter(Boolean).join(" · ");

  const summarizeGroup = (v: ProductFormValues) =>
    [
      v.is_enabled ? null : "Hidden from buyers",
      v.description.trim() !== "" ? "Has a description" : "No description",
      describeSaleWindow(productWindow(v)),
    ].filter(Boolean).join(" · ");

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const input = {
        title: values.title,
        description: values.description.trim() === "" ? null : values.description,
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
        // Only sent when the bundles feature is on, so a stale value never flips it.
        ...(bundlesEnabled ? { bundle_only: values.type === "TIERED" ? false : values.bundle_only } : {}),
        tiers:
          values.type === "TIERED"
            ? values.tiers.map(
                (t, index): TicketOptionInput => ({
                  id: t.id,
                  name: t.name,
                  description: t.description.trim() === "" ? null : t.description,
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
                  ...(bundlesEnabled ? { bundle_only: t.bundle_only } : {}),
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
        revealErrors(flat);
        if (flat.tiers) {
          notifications.show({ color: "red", message: flat.tiers });
        }
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  const tiers = form.values.tiers;
  const isTiered = form.values.type === "TIERED";
  const allOptionsOff = isTiered && tiers.length > 0 && tiers.every((t) => !t.is_enabled);

  // For a single ticket this sits in the main form; a group tucks it into "More group settings".
  const descriptionEditor = (
    <TicketDescriptionEditor
      value={form.values.description}
      onChange={(html) => form.setFieldValue("description", html)}
      error={form.errors.description}
      description={
        isTiered
          ? "Optional. Shown under every option in this group. An option that has its own description shows that instead of this one."
          : undefined
      }
    />
  );

  const meta = form.values.type === "PAID" || form.values.type === "REGISTRATION" || form.values.type === "TIERED" ? TYPE_META[form.values.type] : null;

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Text fw={600} size="lg">{isEdit ? "Edit ticket type" : "Add ticket type"}</Text>}
      size="lg"
      fullScreen={isMobile}
    >
      <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values), revealErrors)}>
        <Stack gap="lg">
          {isEdit ? (
            <Select
              label="Pricing type"
              withAsterisk
              data={
                product?.type === "FREE"
                  ? [{ value: "FREE", label: "Free (legacy)", disabled: true }, ...PRICING_OPTIONS]
                  : PRICING_OPTIONS
              }
              allowDeselect={false}
              {...form.getInputProps("type")}
            />
          ) : (
            meta && (
              <Group gap="sm" wrap="nowrap" p="sm" style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-md)" }}>
                <meta.icon size={22} aria-hidden="true" />
                <Stack gap={0}>
                  <Text size="sm" fw={600}>{meta.label}</Text>
                  <Text size="xs" c="dimmed">{meta.description}</Text>
                </Stack>
              </Group>
            )
          )}

          {isTiered ? (
            <Stack gap={4}>
              <HelpFieldLabel
                htmlFor="ticket-group-title"
                required
                help="The group title describes the sales phase or ticket collection. Examples include Early Bird Ticket, Late Admission, Door Sales, and Weekend Pass. Buyers will see it together with their selected option, such as Early Bird Ticket — Standard."
              >
                Ticket group title
              </HelpFieldLabel>
              <TextInput
                id="ticket-group-title"
                placeholder="Early Bird Ticket"
                {...form.getInputProps("title")}
              />
            </Stack>
          ) : (
            <TextInput label="Ticket title" withAsterisk placeholder="General Admission" {...form.getInputProps("title")} />
          )}

          {!isTiered && descriptionEditor}

          <SimpleGrid cols={{ base: 1, sm: form.values.type === "PAID" ? 2 : 1 }} spacing="md">
            {form.values.type === "PAID" && (
              <NumberInput
                label="Price"
                withAsterisk
                prefix={currencySymbol(eventCurrency)}
                min={0}
                decimalScale={currencyExponent(eventCurrency)}
                inputWrapperOrder={["label", "input", "description", "error"]}
                {...form.getInputProps("price")}
              />
            )}
            <NumberInput
              label="Total quantity available"
              withAsterisk={isTiered}
              description={isTiered ? "Required — the cap across all ticket options in this group." : "Leave blank for unlimited."}
              inputWrapperOrder={["label", "input", "description", "error"]}
              min={0}
              clampBehavior="blur"
              {...form.getInputProps("quantity_available")}
            />
          </SimpleGrid>
          {isTiered && enabledTierQuantitySum(tiers) !== null && (
            <Text size="xs" c="dimmed" mt={-8}>
              Enabled ticket options currently add up to {enabledTierQuantitySum(tiers)} tickets.
            </Text>
          )}

          {!isTiered && (
            <Switch label="Enabled" description="Turn off to hide this ticket from buyers." {...form.getInputProps("is_enabled", { type: "checkbox" })} />
          )}

          <MoreSettings
            label={isTiered ? "More group settings" : "More settings"}
            opened={moreOpen}
            onToggle={() => setMoreOpen((open) => !open)}
            customised={productCustomised(form.values)}
            summary={isTiered ? summarizeGroup(form.values) : summarize(form.values.max_attendees_per_registration, productWindow(form.values), form.values.bundle_only, true)}
          >
            {isTiered && descriptionEditor}
            {!isTiered && (
              <NumberInput
                label="Max attendees per registration"
                description="The most tickets one buyer can add to a single order. Leave blank for no limit."
                inputWrapperOrder={["label", "input", "description", "error"]}
                min={1}
                allowDecimal={false}
                {...form.getInputProps("max_attendees_per_registration")}
              />
            )}
            <SaleWindowFields
              idPrefix="product"
              timezone={eventTimezone}
              value={productWindow(form.values)}
              onChange={(next) => form.setValues(next)}
              startError={form.errors.starts_at_time ?? form.errors.starts_at_date}
              endError={form.errors.ends_at_time ?? form.errors.ends_at_date}
              note={isTiered ? "Applies on top of each ticket option's own window." : undefined}
            />
            {isTiered && (
              <Switch
                label="Enabled"
                description={
                  form.values.is_enabled
                    ? "Turn off to hide the whole group from buyers. Each option keeps its own Enabled setting, so turning the group back on restores what was on sale."
                    : "Hidden from buyers. Turn on to put the group back on sale (only its enabled options are shown)."
                }
                {...form.getInputProps("is_enabled", { type: "checkbox" })}
              />
            )}
            {bundlesEnabled && !isTiered && (
              <Switch
                label="Only sold in bundles"
                description="Hidden from the ticket list. Buyers get it only as part of a bundle (e.g. Child tickets in a Family Pass)."
                {...form.getInputProps("bundle_only", { type: "checkbox" })}
              />
            )}
          </MoreSettings>

          {isTiered && (
            <Stack gap="md">
              <Divider label="Ticket options" labelPosition="left" />
              {tiers.map((tier, index) => (
                <Card key={tier.uid} withBorder radius="md" p="md">
                  <Stack gap="sm">
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm" fw={600}>
                        Ticket option {index + 1}
                      </Text>
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon variant="subtle" size="sm" aria-label="Move option up" disabled={index === 0} onClick={() => form.reorderListItem("tiers", { from: index, to: index - 1 })}>
                          <IconChevronUp size={14} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" size="sm" aria-label="Move option down" disabled={index === tiers.length - 1} onClick={() => form.reorderListItem("tiers", { from: index, to: index + 1 })}>
                          <IconChevronDown size={14} />
                        </ActionIcon>
                        <Tooltip label="Duplicate option">
                          <ActionIcon
                            variant="subtle"
                            size="sm"
                            aria-label="Duplicate option"
                            onClick={() => {
                              // A copy is a brand-new option: no id (so it isn't treated as the sold original), no sales.
                              const copy: TierFormValue = { ...tier, uid: crypto.randomUUID(), id: null, name: tier.name ? `${tier.name} (copy)` : "" };
                              form.insertListItem("tiers", copy, index + 1);
                            }}
                          >
                            <IconCopy size={14} />
                          </ActionIcon>
                        </Tooltip>
                        <ActionIcon variant="subtle" color="red" size="sm" aria-label="Remove option" disabled={tiers.length === 1} onClick={() => form.removeListItem("tiers", index)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    </Group>

                    <Grid gutter="sm">
                      <Grid.Col span={{ base: 12, sm: 6 }}>
                        <Stack gap={4}>
                          <HelpFieldLabel
                            htmlFor={`ticket-option-name-${index}`}
                            required
                            help="The option describes what the buyer receives within this ticket group. Examples include General Admission, Standard, Standard+, VIP, Student, and Balcony."
                          >
                            Ticket option name
                          </HelpFieldLabel>
                          <TextInput
                            id={`ticket-option-name-${index}`}
                            placeholder="Enter ticket option name"
                            {...form.getInputProps(`tiers.${index}.name`)}
                          />
                        </Stack>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <NumberInput
                          label="Price"
                          withAsterisk
                          prefix={currencySymbol(eventCurrency)}
                          min={0}
                          decimalScale={currencyExponent(eventCurrency)}
                          {...form.getInputProps(`tiers.${index}.price`)}
                        />
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, sm: 3 }}>
                        <NumberInput
                          label="Capacity"
                          withAsterisk
                          min={0}
                          clampBehavior="blur"
                          {...form.getInputProps(`tiers.${index}.quantity_available`)}
                        />
                      </Grid.Col>
                    </Grid>

                    <TicketDescriptionEditor
                      label="Option description"
                      description="Optional. If filled in, buyers see this instead of the ticket group description for this option. Leave empty to use the group description."
                      value={tier.description}
                      onChange={(html) => form.setFieldValue(`tiers.${index}.description`, html)}
                      error={form.errors[`tiers.${index}.description`]}
                    />

                    <Switch label="Enabled" {...form.getInputProps(`tiers.${index}.is_enabled`, { type: "checkbox" })} />

                    <MoreSettings
                      label="More settings"
                      opened={!!openOptions[tier.uid]}
                      onToggle={() => setOpenOptions((current) => ({ ...current, [tier.uid]: !current[tier.uid] }))}
                      customised={tierCustomised(tier)}
                      summary={summarize(tier.max_attendees_per_registration, tier, tier.bundle_only, true)}
                    >
                      <NumberInput
                        label="Max attendees per registration"
                        description="The most of this option one buyer can add to an order. Leave blank for no limit."
                        inputWrapperOrder={["label", "input", "description", "error"]}
                        min={1}
                        allowDecimal={false}
                        {...form.getInputProps(`tiers.${index}.max_attendees_per_registration`)}
                      />
                      <SaleWindowFields
                        idPrefix={`option-${tier.uid}`}
                        timezone={eventTimezone}
                        value={tier}
                        onChange={(next) => form.setFieldValue(`tiers.${index}`, { ...tier, ...next })}
                        startError={form.errors[`tiers.${index}.starts_at_time`] ?? form.errors[`tiers.${index}.starts_at_date`]}
                        endError={form.errors[`tiers.${index}.ends_at_time`] ?? form.errors[`tiers.${index}.ends_at_date`]}
                      />
                      {bundlesEnabled && (
                        <Switch
                          label="Only sold in bundles"
                          description="Hidden from buyers; sold only inside bundles."
                          {...form.getInputProps(`tiers.${index}.bundle_only`, { type: "checkbox" })}
                        />
                      )}
                    </MoreSettings>
                  </Stack>
                </Card>
              ))}
              {allOptionsOff && form.values.is_enabled && (
                <Text size="xs" c="orange.8" role="status">
                  Every option is turned off, so buyers won&apos;t see this group. Enable at least one option, or turn the group off in More group settings.
                </Text>
              )}
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={() => form.insertListItem("tiers", emptyTier())}
              >
                Add ticket option
              </Button>
            </Stack>
          )}

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>
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
