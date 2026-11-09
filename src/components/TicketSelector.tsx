"use client";

import { useId, useState, type ReactNode } from "react";
import { ActionIcon, Badge, Box, Card, Collapse, Group, NumberInput, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconMinus, IconPlus } from "@tabler/icons-react";
import { TicketDescription } from "@/components/TicketDescription";
import type { PublicBundle, PublicProduct, PublicTicketOption } from "@/lib/publicEventApi";
import { bundleLineKey, isBundleAvailable, maxBundleQuantity, maxTicketQuantityInCart } from "@/lib/bundleCart";
import { formatMoney } from "@/lib/money";
import { entriesHaveSelection, resolveLayout, type LayoutNode, type ResolvedEntry } from "@/lib/ticketLayout";

import { isLineAvailable, maxQuantityFor, ticketLineKey } from "@/lib/ticketLimits";

export { ticketLineKey };

export function TicketSelector({ products, quantities, onQuantityChange, currencyCode, lineDiscounts, bundles = [], onBundleQuantityChange, ticketLayout, readOnly = false }: {
  products: PublicProduct[];
  quantities: Record<string, number>;
  onQuantityChange: (productId: number, optionId: number | null, quantity: number) => void;
  currencyCode: string;
  /** Per-line offer badge (see lib/offerLineBadges.ts), keyed by ticketLineKey / bundleLineKey. */
  lineDiscounts?: Record<string, { badge: string }>;
  /** Packages (Rave Crew = 5 × General Access). Quantities are keyed by bundleLineKey. */
  bundles?: PublicBundle[];
  onBundleQuantityChange?: (bundleId: number, quantity: number) => void;
  /** The organizer's arrangement (tickets, groups and packages in one list, optionally in sections). Absent = tickets, then packages. */
  ticketLayout?: LayoutNode[];
  /** The organizer's preview: same rendering, quantity controls off. */
  readOnly?: boolean;
}) {
  const shownBundles = onBundleQuantityChange || readOnly ? bundles : [];
  if (products.length === 0 && shownBundles.length === 0) return <Text c="dimmed" size="sm">No tickets available for this event yet.</Text>;

  // Steppers account for stock already taken by the rest of the cart (a
  // Crew and a Solo General Access share the same General Access tickets).
  const ticketMax = (product: PublicProduct, option: PublicTicketOption | null) =>
    maxTicketQuantityInCart(maxQuantityFor(product, option), quantities, products, bundles, product.id, option?.id ?? null);

  const renderEntry = (entry: ResolvedEntry) => {
    if (entry.kind === "bundle") {
      const bundle = entry.bundle;
      return (
        <BundleRow key={`bundle:${bundle.id}`} bundle={bundle} quantity={quantities[bundleLineKey(bundle.id)] ?? 0}
          max={maxBundleQuantity(bundle, quantities, products, bundles)} readOnly={readOnly}
          onChange={(quantity) => onBundleQuantityChange?.(bundle.id, quantity)} currencyCode={currencyCode}
          discountBadge={lineDiscounts?.[bundleLineKey(bundle.id)]?.badge} />
      );
    }
    const product = entry.product;
    return product.type === "TIERED" ? (product.options ?? []).map((option) => (
      <TicketOptionRow key={ticketLineKey(product.id, option.id)} product={product} option={option} readOnly={readOnly}
        quantity={quantities[ticketLineKey(product.id, option.id)] ?? 0} max={ticketMax(product, option)}
        onChange={(quantity) => onQuantityChange(product.id, option.id, quantity)} currencyCode={currencyCode}
        discountBadge={lineDiscounts?.[ticketLineKey(product.id, option.id)]?.badge} />
    )) : (
      <TicketOptionRow key={ticketLineKey(product.id, null)} product={product} option={null} readOnly={readOnly}
        quantity={quantities[ticketLineKey(product.id, null)] ?? 0} max={ticketMax(product, null)}
        onChange={(quantity) => onQuantityChange(product.id, null, quantity)} currencyCode={currencyCode}
        discountBadge={lineDiscounts?.[ticketLineKey(product.id, null)]?.badge} />
    );
  };

  return <Stack gap="sm">
    {resolveLayout(ticketLayout, products, shownBundles).map((node) =>
      node.type === "entry" ? renderEntry(node.entry) : (
        <TicketSection key={`section:${node.id}`} title={node.title} description={node.description}
          collapsedByDefault={node.collapsedByDefault} hasSelection={entriesHaveSelection(node.entries, quantities)}>
          {node.entries.map(renderEntry)}
        </TicketSection>
      ),
    )}
  </Stack>;
}

/**
 * A heading-only group of tickets. Buyers can fold it; it starts folded only when the
 * organizer chose so, and opens by itself the moment something in it is in the cart
 * (a restored draft, an edit from checkout) so a selection is never hidden.
 */
function TicketSection({ title, description, collapsedByDefault, hasSelection, children }: {
  title: string; description: string | null; collapsedByDefault: boolean; hasSelection: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(!collapsedByDefault || hasSelection);
  // Open when something in it becomes selected (adjusting state during render, not in an effect).
  const [hadSelection, setHadSelection] = useState(hasSelection);
  if (hasSelection !== hadSelection) {
    setHadSelection(hasSelection);
    if (hasSelection) setOpen(true);
  }
  const panelId = useId();
  return (
    // A bordered box, so what sits inside a section is visibly inside it (and a folded one
    // reads as one block, not a heading over the tickets that follow it).
    <Box style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: "var(--mantine-radius-lg)", padding: "var(--mantine-spacing-sm)" }}>
      <UnstyledButton type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={panelId} w="100%">
        <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" style={{ overflowWrap: "anywhere" }}>{title}</Text>
            {description && <Text size="xs" c="dimmed" style={{ overflowWrap: "anywhere" }}>{description}</Text>}
          </Stack>
          <IconChevronDown size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, transition: "transform 150ms", transform: open ? "rotate(180deg)" : undefined }} />
        </Group>
      </UnstyledButton>
      <Collapse in={open} id={panelId}><Stack gap="sm" pt="sm">{children}</Stack></Collapse>
    </Box>
  );
}

/** A package row: one price for several tickets, each person still getting their own ticket. */
function BundleRow({ bundle, quantity, max, onChange, currencyCode, discountBadge, readOnly = false }: {
  bundle: PublicBundle; quantity: number; max: number; onChange: (quantity: number) => void; currencyCode: string; discountBadge?: string; readOnly?: boolean;
}) {
  const available = isBundleAvailable(bundle) && max > 0;
  const textColor = "var(--mantine-color-grey-9)";
  const mutedColor = "var(--mantine-color-grey-6)";
  const contents = bundle.components.map((c) => `${c.quantity} × ${c.label ?? "Ticket"}`).join(" + ");
  const saving = Number(bundle.saving);

  return (
    <Card radius="lg" p="md" bg="var(--mantine-color-grey-1)">
      <Stack gap={8}>
        <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
          <Text fw={500} size="sm" c={textColor} style={{ overflowWrap: "anywhere" }}>{bundle.title}</Text>
          <Text fw={500} size="sm" c={textColor} style={{ whiteSpace: "nowrap" }}>{formatMoney(bundle.price, currencyCode)}</Text>
        </Group>
        <Text size="xs" c={mutedColor}>
          {contents} · {formatMoney(bundle.price_per_person, currencyCode)} per person
          {saving > 0 ? ` · save ${formatMoney(saving, currencyCode)}` : ""}
        </Text>
        {discountBadge && available && <Text size="xs" fw={600} c="#18794e" role="status">{discountBadge}</Text>}
        {!available && (
          <Group justify="flex-end">
            <Badge color={bundle.status === "SOLD_OUT" || max === 0 ? "red" : "gray"} variant="light" size="sm">
              {bundle.status === "UNAVAILABLE" ? "NOT ON SALE" : "SOLD OUT"}
            </Badge>
          </Group>
        )}
        <Group justify="space-between" align="center">
          <Text size="xs" c={mutedColor}>Quantity</Text>
          <QuantityStepper value={quantity} onChange={onChange} max={max} disabled={readOnly || (!available && quantity === 0)} />
        </Group>
        <TicketDescription html={bundle.description} color={mutedColor} collapsible />
      </Stack>
    </Card>
  );
}

/**
 * −  [n]  +  quantity control. Big square tap targets for the buttons, and
 * the middle is a real number field so a buyer after 20 or 30 tickets can
 * just type it instead of tapping + twenty times. Value is clamped to
 * 0–max (on blur, so mid-typing "2" -> "20" isn't fought) and rejects
 * decimals / negatives.
 */
function QuantityStepper({ value, onChange, max, disabled }: {
  value: number; onChange: (value: number) => void; max: number; disabled?: boolean;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(0, Math.trunc(n)));
  return (
    <Group gap={4} wrap="nowrap" style={{ flex: "0 0 auto" }}>
      <ActionIcon
        variant="default" size="lg" radius="md" aria-label="Remove one"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        <IconMinus size={16} />
      </ActionIcon>
      <NumberInput
        aria-label="Quantity"
        value={value}
        onChange={(v) => onChange(clamp(typeof v === "number" && Number.isFinite(v) ? v : 0))}
        min={0}
        max={max}
        step={1}
        allowDecimal={false}
        allowNegative={false}
        hideControls
        clampBehavior="blur"
        disabled={disabled}
        size="sm"
        w={52}
        styles={{ input: { textAlign: "center", fontWeight: 600, paddingInline: 4, fontVariantNumeric: "tabular-nums" } }}
      />
      <ActionIcon
        variant="default" size="lg" radius="md" aria-label="Add one"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <IconPlus size={16} />
      </ActionIcon>
    </Group>
  );
}

function TicketOptionRow({ product, option, quantity, max, onChange, currencyCode, discountBadge, readOnly = false }: {
  product: PublicProduct; option: PublicTicketOption | null; quantity: number; max: number;
  onChange: (quantity: number) => void; currencyCode: string; discountBadge?: string; readOnly?: boolean;
}) {
  const status = option?.status ?? (product.is_sold_out ? "SOLD_OUT" : product.is_on_sale ? "AVAILABLE" : "PAUSED");
  const available = isLineAvailable(product, option);
  const remaining = option?.quantity_remaining ?? product.quantity_remaining;
  // Only worth surfacing once stock is actually running low — see
  // Product::isLowStock() for the exact (complimentary-aware) threshold.
  const isLowStock = option?.is_low_stock ?? product.is_low_stock;
  // Per-order cap: the organizer's max-per-registration (10 when unset),
  // further limited by what's actually left. No extra hardcoded ceiling —
  // an organizer allowing 50 per order should get 50.
  const price = option?.price ?? product.current_price;
  const heading = option?.name ?? product.title;
  const subtitleParts = [
    isLowStock && remaining !== null ? `${remaining} remaining` : null,
  ].filter((part): part is string => part !== null);

  // Same reasoning as OrderSummaryCard: this card's background is
  // deliberately light regardless of site color scheme, so text needs
  // an explicit dark color rather than the theme-default, which is a
  // light grey in dark mode and unreadable against a light background.
  const textColor = "var(--mantine-color-grey-9)";
  const mutedColor = "var(--mantine-color-grey-6)";

  return (
    <Card radius="lg" p="md" bg="var(--mantine-color-grey-1)">
      <Stack gap={8}>
        <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
          <Text fw={500} size="sm" c={textColor} style={{ overflowWrap: "anywhere" }}>{heading}</Text>
          <Text fw={500} size="sm" c={textColor} style={{ whiteSpace: "nowrap" }}>{formatMoney(price, currencyCode)}</Text>
        </Group>
        {discountBadge && available && (
          // Savings colour: 4.5:1+ on this card's always-light background.
          <Text size="xs" fw={600} c="#18794e" role="status">{discountBadge}</Text>
        )}
        {(subtitleParts.length > 0 || !available) && (
          <Group justify="space-between" align="center" gap="xs">
            <Text size="xs" c={mutedColor}>{subtitleParts.join(" · ")}</Text>
            {!available && <Badge color={status === "SOLD_OUT" ? "red" : "gray"} variant="light" size="sm">{status.replaceAll("_", " ")}</Badge>}
          </Group>
        )}
        <Group justify="space-between" align="center">
          <Text size="xs" c={mutedColor}>Quantity</Text>
          <QuantityStepper
            value={quantity}
            onChange={onChange}
            max={Math.max(quantity, max)}
            disabled={readOnly || !available}
          />
        </Group>
        {/* Below the stepper on purpose: expanding a long description must never push the quantity control down. */}
        <TicketDescription html={option ? option.description : product.description} color={mutedColor} collapsible />
      </Stack>
    </Card>
  );
}
