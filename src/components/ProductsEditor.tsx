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
import { createProduct, type PricingType, type Product, type TierInput, updateProduct } from "@/lib/productApi";

type TierFormValue = {
  id: number | null;
  name: string;
  price: string;
  starts_at: string;
  ends_at: string;
  quantity_threshold: string;
  is_enabled: boolean;
};

type ProductFormValues = {
  title: string;
  type: PricingType;
  price: string;
  quantity_available: string;
  tiers: TierFormValue[];
};

const PRICING_OPTIONS: { value: PricingType; label: string }[] = [
  { value: "FREE", label: "Free" },
  { value: "PAID", label: "Paid (single price)" },
  { value: "TIERED", label: "Tiered pricing" },
];

function emptyTier(): TierFormValue {
  return { id: null, name: "", price: "", starts_at: "", ends_at: "", quantity_threshold: "", is_enabled: true };
}

function toDatetimeLocal(isoString: string | null): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function productToFormValues(product?: Product): ProductFormValues {
  if (!product) {
    return { title: "", type: "PAID", price: "", quantity_available: "", tiers: [emptyTier()] };
  }
  return {
    title: product.title,
    type: product.type === "TIERED" ? "TIERED" : product.type === "FREE" ? "FREE" : "PAID",
    price: product.price ?? "",
    quantity_available: product.quantity_available !== null ? String(product.quantity_available) : "",
    tiers:
      product.price_tiers.length > 0
        ? product.price_tiers.map((t) => ({
            id: t.id,
            name: t.name,
            price: t.price,
            starts_at: toDatetimeLocal(t.starts_at),
            ends_at: toDatetimeLocal(t.ends_at),
            quantity_threshold: t.quantity_threshold !== null ? String(t.quantity_threshold) : "",
            is_enabled: t.is_enabled,
          }))
        : [emptyTier()],
  };
}

export function ProductsEditor({
  eventId,
  initialProducts,
  disabled,
}: {
  eventId: number;
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
                  </Group>
                  <Text size="sm" c="dimmed">
                    {productSummary(product)}
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

function productSummary(product: Product): string {
  if (product.type === "FREE") {
    return product.quantity_available !== null ? `Free · ${product.quantity_remaining} of ${product.quantity_available} left` : "Free · unlimited";
  }
  if (product.type === "TIERED") {
    const count = product.price_tiers.filter((t) => t.is_enabled).length;
    return `${count} active tier${count === 1 ? "" : "s"}${product.current_price ? ` · currently $${product.current_price}` : ""}`;
  }
  return product.quantity_available !== null
    ? `$${product.price} · ${product.quantity_remaining} of ${product.quantity_available} left`
    : `$${product.price} · unlimited`;
}

function ProductFormModal({
  eventId,
  product,
  onClose,
  onSaved,
}: {
  eventId: number;
  product?: Product;
  onClose: () => void;
  onSaved: (product: Product) => void;
}) {
  const isEdit = product !== undefined;

  const router = useRouter();

  const form = useForm<ProductFormValues>({
    initialValues: productToFormValues(product),
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      price: (v, values) => (values.type === "PAID" && v.trim().length === 0 ? "Price is required" : null),
      tiers: {
        name: (v, values, path) =>
          values.type === "TIERED" && path.startsWith("tiers") && v.trim().length === 0 ? "Name is required" : null,
        price: (v, values) => (values.type === "TIERED" && v.trim().length === 0 ? "Price is required" : null),
      },
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: ProductFormValues) => {
      const input = {
        title: values.title,
        type: values.type,
        price: values.type === "PAID" ? Number(values.price) : null,
        quantity_available: values.quantity_available.trim() === "" ? null : Number(values.quantity_available),
        tiers:
          values.type === "TIERED"
            ? values.tiers.map(
                (t, index): TierInput => ({
                  id: t.id,
                  name: t.name,
                  sort_order: index,
                  price: Number(t.price),
                  starts_at: t.starts_at ? new Date(t.starts_at).toISOString() : null,
                  ends_at: t.ends_at ? new Date(t.ends_at).toISOString() : null,
                  quantity_threshold: t.quantity_threshold.trim() === "" ? null : Number(t.quantity_threshold),
                  is_enabled: t.is_enabled,
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
          <TextInput label="Title" placeholder="General Admission" {...form.getInputProps("title")} />
          <Select
            label="Pricing type"
            data={PRICING_OPTIONS}
            allowDeselect={false}
            {...form.getInputProps("type")}
          />

          {form.values.type === "PAID" && (
            <NumberInput label="Price" prefix="$" min={0} decimalScale={2} {...form.getInputProps("price")} />
          )}

          <NumberInput
            label="Total quantity available"
            description="Leave blank for unlimited"
            min={0}
            {...form.getInputProps("quantity_available")}
          />

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
                      prefix="$"
                      min={0}
                      decimalScale={2}
                      {...form.getInputProps(`tiers.${index}.price`)}
                    />
                    <Group grow>
                      <TextInput
                        type="datetime-local"
                        label="Starts (optional)"
                        {...form.getInputProps(`tiers.${index}.starts_at`)}
                      />
                      <TextInput
                        type="datetime-local"
                        label="Ends (optional)"
                        {...form.getInputProps(`tiers.${index}.ends_at`)}
                      />
                    </Group>
                    <NumberInput
                      label="Quantity available in this tier"
                      description="Leave blank for unlimited"
                      min={0}
                      {...form.getInputProps(`tiers.${index}.quantity_threshold`)}
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
                Add tier
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
