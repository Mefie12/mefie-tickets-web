"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { useMediaQuery } from "@mantine/hooks";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconPackages, IconPlayerPause, IconPlayerPlay, IconPlus, IconTrash } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { TicketDescriptionEditor, TICKET_DESCRIPTION_MAX_LENGTH } from "@/components/TicketDescriptionEditor";
import { describeSaleWindow, hasSaleWindow, MoreSettings, SaleWindowFields, type WindowParts } from "@/components/TicketFormParts";
import { utcIsoToZonedPartsOrEmpty } from "@/lib/eventDateTime";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import {
  createBundle,
  deleteBundle,
  listBundles,
  updateBundle,
  type Bundle,
  type BundleInput,
  type Product,
} from "@/lib/productApi";
import { currencyExponent, currencySymbol, formatMoney } from "@/lib/money";

type ComponentRow = { key: string; quantity: number | "" };

type BundleFormValues = {
  title: string;
  description: string;
  price: number | "";
  components: ComponentRow[];
  quantity_available: number | "";
  max_per_order: number | "";
  is_enabled: boolean;
} & WindowParts;

/** "p:12" = whole ticket 12; "t:12:34" = option 34 of ticket group 12. */
function componentKey(productId: number, optionId: number | null): string {
  return optionId === null ? `p:${productId}` : `t:${productId}:${optionId}`;
}

function parseKey(key: string): { product_id: number; ticket_option_id: number | null } {
  const [kind, productId, optionId] = key.split(":");
  return { product_id: Number(productId), ticket_option_id: kind === "t" ? Number(optionId) : null };
}

/** Every ticket (or ticket option) a bundle can include, with its list price. */
function componentChoices(products: Product[]): { value: string; label: string; price: number }[] {
  return products.flatMap((product) =>
    product.type === "TIERED"
      ? product.price_tiers.map((tier) => ({
          value: componentKey(product.id, tier.id),
          label: `${product.title} — ${tier.name}`,
          price: Number(tier.price),
        }))
      : [{ value: componentKey(product.id, null), label: product.title, price: Number(product.price ?? 0) }],
  );
}

/**
 * Organizer management of ticket bundles: one price that issues ordinary
 * tickets of existing ticket types (Rave Crew = 5 × General Access,
 * Family Pass = 2 Adult + 2 Child). Shown only when the bundles feature
 * is enabled for the platform.
 */
export function BundlesEditor({
  eventId,
  eventCurrency,
  eventTimezone,
  products,
  disabled,
}: {
  eventId: number;
  eventCurrency: string;
  eventTimezone: string;
  products: Product[];
  disabled: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [modalBundle, setModalBundle] = useState<Bundle | "new" | null>(null);
  const queryKey = ["bundles", eventId];
  const { data } = useQuery({ queryKey, queryFn: () => listBundles(eventId) });
  const bundles = data?.bundles ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const toggleMutation = useMutation({
    mutationFn: (bundle: Bundle) => updateBundle(eventId, bundle.id, { is_enabled: !bundle.is_enabled }),
    onSuccess: refresh,
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (bundleId: number) => deleteBundle(eventId, bundleId),
    onSuccess: () => {
      refresh();
      notifications.show({ color: "teal", message: "Bundle deleted." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error instanceof ApiError && error.errors ? Object.values(error.errors)[0][0] : error.message });
    },
  });

  return (
    <Stack gap="sm" mt="lg">
      <Group justify="space-between">
        <Stack gap={0}>
          <Title order={4}>Bundles</Title>
          <Text size="sm" c="dimmed">
            One price for several tickets — e.g. Rave Crew = 5 × General Access, or Family Pass = 2 Adult + 2 Child. Each person still gets their own ticket.
          </Text>
        </Stack>
        {!disabled && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModalBundle("new")} disabled={products.length === 0}>
            Add bundle
          </Button>
        )}
      </Group>

      {bundles.length === 0 ? (
        <Card withBorder radius="lg" p="lg">
          <Group gap="sm" justify="center">
            <IconPackages size={24} opacity={0.5} />
            <Text c="dimmed" size="sm">No bundles yet.</Text>
          </Group>
        </Card>
      ) : (
        bundles.map((bundle) => (
          <Card key={bundle.id} withBorder radius="lg" p="md">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Group gap="xs">
                  <Text fw={600}>{bundle.title}</Text>
                  {!bundle.is_enabled && <Badge size="sm" color="gray" variant="light">Paused</Badge>}
                  {bundle.is_enabled && bundle.unavailable_reason && (
                    <Badge size="sm" color={bundle.unavailable_reason === "Sold out" ? "red" : "orange"} variant="light">
                      {bundle.unavailable_reason === "Sold out" ? "Sold out" : "Not on sale"}
                    </Badge>
                  )}
                </Group>
                {bundle.is_enabled && bundle.unavailable_reason && bundle.unavailable_reason !== "Sold out" && (
                  <Text size="xs" c="orange.8">{bundle.unavailable_reason}</Text>
                )}
                <Text size="sm" c="dimmed">
                  {bundle.components.map((c) => `${c.quantity} × ${c.label}`).join(" + ")}
                </Text>
                <Text size="sm" c="dimmed">
                  {formatMoney(bundle.price, eventCurrency)} · {bundle.package_size} tickets ·{" "}
                  {formatMoney(Number(bundle.price) / Math.max(1, bundle.package_size), eventCurrency)} per person ·{" "}
                  {bundle.quantity_sold} sold{bundle.quantity_available !== null ? ` of ${bundle.quantity_available}` : ""}
                </Text>
              </Stack>
              {!disabled && (
                <Group gap="xs" wrap="nowrap">
                  <Button size="xs" variant="light" onClick={() => setModalBundle(bundle)}>Edit</Button>
                  <Tooltip label={bundle.is_enabled ? "Pause sales" : "Resume sales"}>
                    <ActionIcon
                      size="lg"
                      variant="light"
                      color="gray"
                      aria-label={bundle.is_enabled ? "Pause bundle" : "Resume bundle"}
                      loading={toggleMutation.isPending && toggleMutation.variables?.id === bundle.id}
                      onClick={() => toggleMutation.mutate(bundle)}
                    >
                      {bundle.is_enabled ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="This bundle has sold. Pause it instead." disabled={!bundle.is_locked}>
                    <ActionIcon
                      size="lg"
                      variant="light"
                      color="red"
                      aria-label="Delete bundle"
                      disabled={bundle.is_locked}
                      onClick={() =>
                        modals.openConfirmModal({
                          title: "Delete bundle?",
                          children: <Text size="sm">“{bundle.title}” will be removed. Tickets already sold are not affected.</Text>,
                          labels: { confirm: "Delete", cancel: "Cancel" },
                          confirmProps: { color: "red" },
                          onConfirm: () => deleteMutation.mutate(bundle.id),
                        })
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              )}
            </Group>
          </Card>
        ))
      )}

      {modalBundle !== null && (
        <BundleFormModal
          eventId={eventId}
          eventCurrency={eventCurrency}
          eventTimezone={eventTimezone}
          products={products}
          bundle={modalBundle === "new" ? undefined : modalBundle}
          onClose={() => setModalBundle(null)}
          onSaved={() => {
            refresh();
            setModalBundle(null);
          }}
        />
      )}
    </Stack>
  );
}

function BundleFormModal({
  eventId,
  eventCurrency,
  eventTimezone,
  products,
  bundle,
  onClose,
  onSaved,
}: {
  eventId: number;
  eventCurrency: string;
  eventTimezone: string;
  products: Product[];
  bundle?: Bundle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const isEdit = bundle !== undefined;
  const locked = bundle?.is_locked ?? false;
  const choices = useMemo(() => componentChoices(products), [products]);
  const isMobile = useMediaQuery("(max-width: 36em)");
  const windowOf = (v: WindowParts): WindowParts => ({
    starts_at_date: v.starts_at_date, starts_at_time: v.starts_at_time, ends_at_date: v.ends_at_date, ends_at_time: v.ends_at_time,
  });

  const form = useForm<BundleFormValues>({
    initialValues: {
      title: bundle?.title ?? "",
      description: bundle?.description ?? "",
      price: bundle ? Number(bundle.price) : "",
      components: bundle
        ? bundle.components.map((c) => ({ key: componentKey(c.product_id, c.ticket_option_id), quantity: c.quantity }))
        : [{ key: choices[0]?.value ?? "", quantity: 2 }],
      quantity_available: bundle?.quantity_available ?? "",
      max_per_order: bundle?.max_per_order ?? "",
      is_enabled: bundle?.is_enabled ?? true,
      ...(() => {
        const starts = utcIsoToZonedPartsOrEmpty(bundle?.starts_at, eventTimezone);
        const ends = utcIsoToZonedPartsOrEmpty(bundle?.ends_at, eventTimezone);
        return { starts_at_date: starts.date, starts_at_time: starts.time, ends_at_date: ends.date, ends_at_time: ends.time };
      })(),
    },
    validate: {
      title: (v) => (v.trim() === "" ? "Name the bundle" : null),
      price: (v) => (v === "" || v <= 0 ? "Enter the bundle price" : null),
      description: (v) => (v.length > TICKET_DESCRIPTION_MAX_LENGTH ? "Description is too long." : null),
      ends_at_time: (v, values) =>
        values.starts_at_date && values.ends_at_date && `${values.ends_at_date} ${v}` <= `${values.starts_at_date} ${values.starts_at_time}`
          ? "Must end after it starts"
          : null,
      components: {
        key: (v) => (v === "" ? "Choose a ticket" : null),
        quantity: (v) => (v === "" || v < 1 ? "At least 1" : null),
      },
    },
  });

  // Limits and the sale window live in "More settings": closed by default, open when editing a
  // customised bundle or when an error lands inside.
  const bundleCustomised = (v: BundleFormValues) => v.quantity_available !== "" || v.max_per_order !== "" || hasSaleWindow(v);
  const [moreOpen, setMoreOpen] = useState(() => isEdit && bundleCustomised(form.values));
  const revealErrors = (errors: Record<string, unknown>) => {
    if (Object.keys(errors).some((key) => /^(quantity_available|max_per_order|starts_at_(date|time)|ends_at_(date|time))$/.test(key))) setMoreOpen(true);
  };
  const moreSummary = [
    form.values.quantity_available === "" ? "No limit on bundles sold" : `Up to ${form.values.quantity_available} bundles`,
    form.values.max_per_order === "" ? "no per-order limit" : `up to ${form.values.max_per_order} per order`,
    describeSaleWindow(windowOf(form.values)),
  ].join(" · ");

  const priceOf = (key: string) => choices.find((c) => c.value === key)?.price ?? 0;
  const packageSize = form.values.components.reduce((sum, c) => sum + (c.quantity === "" ? 0 : c.quantity), 0);
  const listTotal = form.values.components.reduce((sum, c) => sum + priceOf(c.key) * (c.quantity === "" ? 0 : c.quantity), 0);

  const mutation = useMutation({
    mutationFn: (values: BundleFormValues) => {
      const input: BundleInput = {
        title: values.title.trim(),
        description: values.description.trim() === "" ? null : values.description,
        quantity_available: values.quantity_available === "" ? null : values.quantity_available,
        max_per_order: values.max_per_order === "" ? null : values.max_per_order,
        is_enabled: values.is_enabled,
        starts_at_date: values.starts_at_date || null,
        starts_at_time: values.starts_at_time || null,
        ends_at_date: values.ends_at_date || null,
        ends_at_time: values.ends_at_time || null,
        ...(locked
          ? {}
          : {
              price: values.price === "" ? 0 : values.price,
              components: values.components.map((c) => ({ ...parseKey(c.key), quantity: c.quantity === "" ? 1 : c.quantity })),
            }),
      };
      return isEdit ? updateBundle(eventId, bundle.id, input) : createBundle(eventId, input);
    },
    onSuccess: (result) => {
      result.warnings.forEach((message) => notifications.show({ color: "yellow", title: "Check this bundle", message, autoClose: 10000 }));
      notifications.show({ color: "teal", message: isEdit ? "Bundle updated." : "Bundle added." });
      onSaved();
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        const flat = Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]]));
        form.setErrors(flat);
        revealErrors(flat);
        if (error.errors.components) notifications.show({ color: "red", message: error.errors.components[0] });
        return;
      }
      notifications.show({ color: "red", message: error.message });
    },
  });

  const priceNumber = form.values.price === "" ? 0 : form.values.price;
  // Mirrors what a buyer will see; while no price is entered the bundle is, for now, free.
  const pricePreview = packageSize > 0
    ? priceNumber > 0
      ? `${packageSize} tickets · ${formatMoney(priceNumber / packageSize, eventCurrency)} per person · ${
          listTotal > priceNumber ? `saves ${formatMoney(listTotal - priceNumber, eventCurrency)} vs single tickets` : "not cheaper than single tickets"
        }`
      : `${packageSize} tickets · currently free per person · saves ${formatMoney(listTotal, eventCurrency)} vs single tickets`
    : undefined;

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Text fw={600} size="lg">{isEdit ? "Edit bundle" : "Add bundle"}</Text>}
      size="lg"
      fullScreen={isMobile}
    >
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values), revealErrors)}>
        <Stack gap="xl">
          {locked && (
            <Alert color="gray" variant="light">
              This bundle has sold, so its price and the tickets inside are locked. You can still rename it, edit the description, change its limits or pause it.
            </Alert>
          )}

          <Stack gap="md">
            <Text fw={600} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: 0.4 }}>Details</Text>
            <TextInput label="Bundle name" withAsterisk placeholder="Rave Crew" {...form.getInputProps("title")} />
            <TicketDescriptionEditor
              value={form.values.description}
              onChange={(html) => form.setFieldValue("description", html)}
              error={form.errors.description}
              description="Optional. Shown under the bundle at checkout."
            />
          </Stack>

          <Stack gap="md">
            <Text fw={600} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: 0.4 }}>Tickets inside</Text>
            {form.values.components.map((row, index) => {
              const each = row.key ? priceOf(row.key) : null;
              const count = row.quantity === "" ? 0 : Number(row.quantity);
              return (
                <Paper key={index} withBorder radius="md" p="md">
                  <Stack gap="sm">
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm" fw={500}>Ticket {index + 1}</Text>
                      {!locked && form.values.components.length > 1 && (
                        <ActionIcon variant="subtle" color="red" aria-label={`Remove ticket ${index + 1}`} onClick={() => form.removeListItem("components", index)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                    <Select
                      aria-label={`Ticket ${index + 1}`}
                      // The price is in each option so it can be read in the list and after choosing.
                      data={choices.map((c) => ({ value: c.value, label: `${c.label} · ${formatMoney(c.price, eventCurrency)}` }))}
                      placeholder="Choose a ticket"
                      disabled={locked}
                      allowDeselect={false}
                      {...form.getInputProps(`components.${index}.key`)}
                    />
                    <Grid gutter="sm">
                      <Grid.Col span={{ base: 12, xs: 4 }}>
                        <NumberInput label="How many" min={1} max={50} disabled={locked} allowDecimal={false} {...form.getInputProps(`components.${index}.quantity`)} />
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, xs: 4 }}>
                        <Stack gap={4}>
                          <Text size="sm" fw={500}>Price each</Text>
                          <Text size="sm" mih={36} style={{ display: "flex", alignItems: "center" }}>{each === null ? "—" : formatMoney(each, eventCurrency)}</Text>
                        </Stack>
                      </Grid.Col>
                      <Grid.Col span={{ base: 6, xs: 4 }}>
                        <Stack gap={4}>
                          <Text size="sm" fw={500}>Subtotal</Text>
                          <Text size="sm" fw={600} mih={36} style={{ display: "flex", alignItems: "center" }}>{each === null ? "—" : formatMoney(each * count, eventCurrency)}</Text>
                        </Stack>
                      </Grid.Col>
                    </Grid>
                  </Stack>
                </Paper>
              );
            })}
            {!locked && (
              <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => form.insertListItem("components", { key: "", quantity: 1 })}>
                Add another ticket
              </Button>
            )}
          </Stack>

          <Stack gap="md">
            <Text fw={600} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: 0.4 }}>Price & limits</Text>
            <NumberInput
              label="Bundle price"
              withAsterisk
              disabled={locked}
              prefix={currencySymbol(eventCurrency)}
              min={0}
              decimalScale={currencyExponent(eventCurrency)}
              inputWrapperOrder={["label", "input", "description", "error"]}
              description={pricePreview}
              {...form.getInputProps("price")}
            />
            <Switch label="Enabled" description="Turn off to hide this bundle from buyers." {...form.getInputProps("is_enabled", { type: "checkbox" })} />
            <MoreSettings opened={moreOpen} onToggle={() => setMoreOpen((open) => !open)} customised={bundleCustomised(form.values)} summary={moreSummary}>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <NumberInput
                  label="Limit"
                  placeholder="No limit"
                  min={1}
                  allowDecimal={false}
                  inputWrapperOrder={["label", "input", "description", "error"]}
                  description="Most bundles you'll sell. Leave blank to sell as many as the tickets allow."
                  {...form.getInputProps("quantity_available")}
                />
                <NumberInput
                  label="Max per order"
                  placeholder="No limit"
                  min={1}
                  allowDecimal={false}
                  inputWrapperOrder={["label", "input", "description", "error"]}
                  description="Most bundles one buyer can add to a single order."
                  {...form.getInputProps("max_per_order")}
                />
              </SimpleGrid>
              <SaleWindowFields
                idPrefix="bundle"
                timezone={eventTimezone}
                value={windowOf(form.values)}
                onChange={(next) => form.setValues(next)}
                startError={form.errors.starts_at_time ?? form.errors.starts_at_date}
                endError={form.errors.ends_at_time ?? form.errors.ends_at_date}
                note="A bundle also follows the sale window of each ticket inside it."
              />
            </MoreSettings>
          </Stack>

          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? "Save bundle" : "Add bundle"}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
