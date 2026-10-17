"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Box, Button, Card, Checkbox, Grid, GridCol, Group, NumberInput, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconInfoCircle, IconRefresh } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { createOffer, updateOffer, type Offer, type OfferActivation, type OfferDiscountType, type OfferInput, type OfferScopeRow } from "@/lib/offersApi";
import { offerErrorMessage } from "@/lib/offerErrors";
import { discountLabel, previewBundle, previewDiscountedUnit } from "@/lib/offerFormat";
import { localInputToUtcIso, utcIsoToLocalInput } from "@/lib/offerDates";
import { samplePriceMinor, scopeLabels, type OfferTicketType } from "@/lib/offerInventory";
import { currencySymbol, formatMinorAmount, currencyExponent, moneyInputProps, toMajorUnits, toMinorUnits } from "@/lib/money";
import { offerTimezoneLabel } from "@/lib/offerTimezone";
import { normalizePromoCode, promoCodeFormatError } from "@/lib/offerCodeFormat";
import { endError, startError } from "@/lib/offerSchedule";

export type Template = "percent" | "fixed" | "automatic" | "group";

type FormState = {
  name: string;
  description: string;
  activation: OfferActivation;
  code: string;
  discountType: OfferDiscountType;
  percent: number | string;
  fixed: number | string;
  /** "" = no minimum. Only for percentage / fixed offers: every ticket of a type is discounted once the cart holds this many. */
  minQuantity: number | string;
  /** GROUP_BUNDLE: tickets per group, the price of one whole group, and an optional cap on groups per order. */
  groupSize: number | string;
  groupPrice: number | string;
  maxGroups: number | string;
  starts: string;
  ends: string;
  globalLimit: number | string;
  perCustomer: number | string;
  perOrder: number | string;
  scope: Record<string, boolean>;
};

const scopeKey = {
  product: (productId: number) => `p:${productId}`,
  option: (productId: number, optionId: number) => `o:${productId}:${optionId}`,
};

function rowsToScopeState(rows: OfferScopeRow[] | undefined): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const row of rows ?? []) {
    state[row.ticket_option_id === null ? scopeKey.product(row.product_id) : scopeKey.option(row.product_id, row.ticket_option_id)] = true;
  }
  return state;
}

function scopeStateToRows(scope: Record<string, boolean>, inventory: OfferTicketType[]): OfferScopeRow[] {
  const rows: OfferScopeRow[] = [];
  for (const type of inventory) {
    if (scope[scopeKey.product(type.productId)]) {
      rows.push({ product_id: type.productId, ticket_option_id: null });
      continue;
    }
    for (const option of type.options) {
      if (scope[scopeKey.option(type.productId, option.id)]) rows.push({ product_id: type.productId, ticket_option_id: option.id });
    }
  }
  return rows;
}

function defaultWindow(timezone: string, eventStart: string | null): { starts: string; ends: string } {
  // Start "now" (to the minute) so an offer activated straight away is live
  // straight away; the end defaults to the event start, else 30 days out.
  const now = new Date();
  now.setSeconds(0, 0);
  const starts = utcIsoToLocalInput(now.toISOString(), timezone);
  const endInstant = eventStart && new Date(eventStart) > now ? new Date(eventStart) : new Date(now.getTime() + 30 * 86_400_000);
  const ends = utcIsoToLocalInput(endInstant.toISOString(), timezone);
  return { starts, ends };
}

function initialState(args: { initial?: Offer; prefill?: Offer; template?: Template; timezone: string; eventStart: string | null }): FormState {
  const { initial, prefill, template, timezone, eventStart } = args;
  if (!initial && prefill) {
    // Duplicate: same economics, scope and limits; a blank code (codes are unique per event, so the
    // server generates one), and a fresh schedule that starts now. The original's end is kept
    // only if it is still in the future.
    const fresh = defaultWindow(timezone, eventStart);
    const originalEnd = utcIsoToLocalInput(prefill.ends_at, timezone);
    return {
      ...initialState({ initial: prefill, timezone, eventStart }),
      name: `${prefill.name} (copy)`,
      code: "",
      starts: fresh.starts,
      ends: new Date(prefill.ends_at) > new Date() ? originalEnd : fresh.ends,
    };
  }
  if (initial) {
    return {
      name: initial.name,
      description: initial.internal_description ?? "",
      activation: initial.activation,
      code: initial.code ?? "",
      discountType: initial.discount_type,
      percent: initial.discount_type === "PERCENTAGE" ? (initial.discount_value ?? 0) / 100 : 10,
      fixed: initial.discount_type === "FIXED_PER_TICKET" ? toMajorUnits(initial.discount_value ?? 0, initial.currency_code) : "",
      minQuantity: initial.min_ticket_quantity ?? "",
      groupSize: initial.group_size ?? 2,
      groupPrice: initial.group_price_minor !== null ? toMajorUnits(initial.group_price_minor, initial.currency_code) : "",
      maxGroups: initial.max_groups_per_order ?? "",
      starts: utcIsoToLocalInput(initial.starts_at, timezone),
      ends: utcIsoToLocalInput(initial.ends_at, timezone),
      globalLimit: initial.global_ticket_limit ?? "",
      perCustomer: initial.per_customer_ticket_limit ?? "",
      perOrder: initial.per_order_ticket_limit ?? "",
      scope: rowsToScopeState(initial.scope),
    };
  }
  const window = defaultWindow(timezone, eventStart);
  return {
    name: template === "automatic" ? "Limited-time sale" : template === "group" ? "Couple price" : "",
    description: "",
    activation: template === "automatic" || template === "group" ? "AUTOMATIC" : "CODE",
    code: "",
    discountType: template === "fixed" ? "FIXED_PER_TICKET" : template === "group" ? "GROUP_BUNDLE" : "PERCENTAGE",
    percent: template === "automatic" ? 15 : 20,
    fixed: "",
    minQuantity: "",
    groupSize: 2,
    groupPrice: "",
    maxGroups: "",
    ...window,
    globalLimit: "",
    perCustomer: "",
    perOrder: "",
    scope: {},
  };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateCode = () => Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

/**
 * One-page create/edit form (DRAFT offers only) with a live preview of how
 * buyers will see it. Money entry is in the event's currency; values are
 * converted to basis points / minor units here, and the server validates
 * everything again — including that the discounted price still covers fees.
 */
export function OfferForm({ eventId, currency, timezone, eventStart, inventory, otherOffers, initial, prefill, template, publicEventPath, onSaved }: {
  eventId: number;
  currency: string;
  timezone: string;
  eventStart: string | null;
  inventory: OfferTicketType[];
  otherOffers: Offer[];
  initial?: Offer;
  /** Duplicate: start a new draft from this existing offer (never edits it). */
  prefill?: Offer;
  template?: Template;
  publicEventPath?: string;
  /** Edit mode: called after a successful save so the host can leave edit mode (the URL doesn't change). */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialState({ initial, prefill, template, timezone, eventStart }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Client-side format feedback for the promo code, shown when the field is left (blank = auto-generate).
  const [codeFormatError, setCodeFormatError] = useState<string | null>(null);
  // Schedule feedback, shown when a date field is left (and re-checked on submit).
  const [scheduleErrors, setScheduleErrors] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  // An existing draft's start is only policed when it is changed.
  const [initialStart] = useState(() => (initial ? initialState({ initial, timezone, eventStart }).starts : undefined));
  const patch = (changes: Partial<FormState>) => setForm((f) => ({ ...f, ...changes }));

  const scopeRows = useMemo(() => scopeStateToRows(form.scope, inventory), [form.scope, inventory]);
  const isBundle = form.discountType === "GROUP_BUNDLE";
  const discountValue = isBundle
    ? 0
    : form.discountType === "PERCENTAGE"
      ? Math.round(Number(form.percent || 0) * 100)
      : toMinorUnits(form.fixed || 0, currency);
  const groupSize = Number(form.groupSize || 0);
  // For hints only: the real size once valid, else a placeholder word that still reads correctly.
  const groupSizeForCopy = groupSize >= 2 ? groupSize : 2;
  const groupPriceMinor = toMinorUnits(form.groupPrice || 0, currency);
  const minQuantity = !isBundle && form.minQuantity !== "" ? Number(form.minQuantity) : null;

  const samplePrice = samplePriceMinor(scopeRows, inventory);
  const examplePrice = samplePrice ?? 10_000;
  const exampleFinal = previewDiscountedUnit(examplePrice, { discount_type: form.discountType, discount_value: discountValue });
  // Tickets the preview prices: a whole group, or the minimum needed for a volume discount.
  const exampleQuantity = isBundle ? Math.max(groupSize, 1) : (minQuantity ?? 1);
  const exampleBundle = isBundle ? previewBundle(examplePrice, { group_size: groupSize, group_price_minor: groupPriceMinor }) : null;
  // The condition a purchase must meet, to compare against the limits below.
  const condition = isBundle ? groupSize : (minQuantity ?? 1);
  const limitTooSmall = (value: number | string) => value !== "" && condition > 1 && Number(value) < condition;
  // Advice shown while typing; the server enforces the hard rules again when the offer is activated.
  const bundleNotCheaper = isBundle && exampleBundle !== null && exampleBundle.savingMinor <= 0;
  const bundleCliff = isBundle && exampleBundle !== null && exampleBundle.savingMinor > 0 && groupPriceMinor < (groupSize - 1) * examplePrice;
  const volumeCliff = !isBundle && minQuantity !== null && discountValue > 0 && minQuantity * (examplePrice - exampleFinal) > examplePrice;
  const conditionalFree = (isBundle && groupPriceMinor > 0 && Math.floor(groupPriceMinor / Math.max(groupSize, 1)) === 0) || (minQuantity !== null && discountValue > 0 && exampleFinal === 0);

  const overlapping = otherOffers.filter((o) => o.id !== initial?.id && (o.status === "ACTIVE" || o.status === "PAUSED") && (o.scope ?? []).some((row) =>
    scopeRows.some((mine) => mine.product_id === row.product_id && (mine.ticket_option_id === null || row.ticket_option_id === null || mine.ticket_option_id === row.ticket_option_id))));
  const automaticActive = form.activation === "AUTOMATIC"
    ? otherOffers.find((o) => o.id !== initial?.id && o.activation === "AUTOMATIC" && o.status === "ACTIVE")
    : undefined;

  const hasDeal = isBundle ? groupSize >= 2 && groupPriceMinor > 0 : discountValue > 0;
  const previewLabel = hasDeal
    ? discountLabel({
        discount_type: form.discountType, discount_value: isBundle ? null : discountValue, min_ticket_quantity: minQuantity,
        group_size: isBundle ? groupSize : null, group_price_minor: isBundle ? groupPriceMinor : null, currency_code: currency,
      })
    : "—";

  const mutation = useMutation({
    mutationFn: () => {
      const input: OfferInput = {
        name: form.name.trim(),
        internal_description: form.description.trim() || null,
        activation: form.activation,
        starts_at: localInputToUtcIso(form.starts, timezone),
        ends_at: localInputToUtcIso(form.ends, timezone),
        discount_type: form.discountType,
        discount_value: isBundle ? null : discountValue,
        min_ticket_quantity: minQuantity,
        group_size: isBundle ? groupSize : null,
        group_price_minor: isBundle ? groupPriceMinor : null,
        max_groups_per_order: isBundle && form.maxGroups !== "" ? Number(form.maxGroups) : null,
        global_ticket_limit: form.globalLimit === "" ? null : Number(form.globalLimit),
        per_customer_ticket_limit: form.perCustomer === "" ? null : Number(form.perCustomer),
        per_order_ticket_limit: form.perOrder === "" ? null : Number(form.perOrder),
        scope: scopeRows,
        ...(form.activation === "CODE" ? { code: form.code.trim() || null } : {}),
      };
      return initial ? updateOffer(eventId, initial.id, input) : createOffer(eventId, input);
    },
    onSuccess: ({ offer }) => {
      setErrors({});
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["offers", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["offer", eventId, offer.id] });
      notifications.show({ color: "teal", message: initial ? "Changes saved." : "Draft saved. Review it, then activate when you’re ready." });
      if (onSaved) {
        onSaved();
      } else {
        router.push(`/events/${eventId}/offers/${offer.id}`);
      }
      router.refresh();
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        const fields: Record<string, string> = {};
        Object.entries(error.errors ?? {}).forEach(([key, value]) => { fields[key] = value[0]; });
        setErrors(fields);
        setFormError(Object.keys(fields).length > 0 ? "Please fix the highlighted fields." : offerErrorMessage(error.code, error.message));
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    },
  });

  const canSubmit = form.name.trim() !== "" && hasDeal && form.starts !== "" && form.ends !== "";

  return (
    <Grid gutter="xl" align="flex-start">
      <GridCol span={{ base: 12, md: 7 }}>
        <form onSubmit={(e) => {
          e.preventDefault();
          // Same check on submit, so a code never reaches the server malformed.
          const error = form.activation === "CODE" ? promoCodeFormatError(normalizePromoCode(form.code)) : null;
          const schedule = { start: startError(form.starts, timezone, { unchangedFrom: initialStart }), end: endError(form.starts, form.ends, timezone) };
          setScheduleErrors(schedule);
          if (error) setCodeFormatError(error);
          if (error || schedule.start || schedule.end) return;
          mutation.mutate();
        }}>
          <Stack gap="xl">
            {prefill && !initial && (
              <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />} title={`Duplicating “${prefill.name}”`}>
                This is a new draft. The discount, tickets and limits are copied; the code is left blank and a new one is generated — a code is never reused on the same event, even after its offer ends, so old links and past reports stay unambiguous. The schedule starts now. The original isn’t changed.
              </Alert>
            )}
            {formError && <Alert color="red" role="alert" icon={<IconAlertTriangle size={18} />}>{formError}</Alert>}

            <Section title="1. Name and how it’s used">
              <TextInput label="Offer name" description="Buyers see this on receipts, so keep it friendly." withAsterisk maxLength={120}
                value={form.name} onChange={(e) => patch({ name: e.currentTarget.value })} error={errors.name} />
              <Stack gap={4}>
                <Text size="sm" fw={500}>Activation</Text>
                <SegmentedControl fullWidth value={form.activation} onChange={(v) => patch({ activation: v as OfferActivation })} disabled={!!initial}
                  data={[{ value: "CODE", label: "Promo code or link" }, { value: "AUTOMATIC", label: "Automatic" }]} aria-label="Activation" />
                <Text size="xs" c="dimmed">
                  {form.activation === "CODE"
                    ? "Buyers enter a code or open your share link. You can give the code to a partner, influencer or a mailing list."
                    : "Applied to every matching cart with nothing to enter. Only one automatic offer can be active at a time."}
                </Text>
              </Stack>
              {form.activation === "CODE" && (
                <Group align="flex-end" gap="xs" wrap="nowrap">
                  <TextInput label="Promo code" description="4–32 letters, numbers, hyphens or underscores. Leave blank to generate one."
                    value={form.code} onChange={(e) => { patch({ code: e.currentTarget.value.toUpperCase() }); setCodeFormatError(null); }}
                    onBlur={() => { const code = normalizePromoCode(form.code); patch({ code }); setCodeFormatError(promoCodeFormatError(code)); }}
                    error={codeFormatError ?? errors.code}
                    style={{ flex: 1 }} autoCapitalize="characters" spellCheck={false} styles={{ input: { fontFamily: "var(--mantine-font-family-monospace)" } }} />
                  <Button variant="default" leftSection={<IconRefresh size={14} />} onClick={() => { patch({ code: generateCode() }); setCodeFormatError(null); }}>Generate</Button>
                </Group>
              )}
              <Textarea label="Internal note (optional)" description="Only your team sees this." autosize minRows={2} maxLength={2000}
                value={form.description} onChange={(e) => patch({ description: e.currentTarget.value })} />
            </Section>

            <Section title="2. Discount">
              <SegmentedControl fullWidth value={form.discountType} onChange={(v) => patch({ discountType: v as OfferDiscountType })}
                data={[
                  { value: "PERCENTAGE", label: "% off" },
                  { value: "FIXED_PER_TICKET", label: "Amount off" },
                  { value: "GROUP_BUNDLE", label: "Group" },
                ]} aria-label="Discount type" disabled={!!initial?.is_locked} />
              {form.discountType === "PERCENTAGE" && (
                <NumberInput label="Percentage" withAsterisk min={0.01} max={100} decimalScale={2} suffix="%" value={form.percent}
                  onChange={(v) => patch({ percent: v })} error={errors.discount_value} />
              )}
              {form.discountType === "FIXED_PER_TICKET" && (
                <NumberInput label="Amount off each ticket" withAsterisk {...moneyInputProps(currency)} prefix={`${currencySymbol(currency)} `} value={form.fixed}
                  onChange={(v) => patch({ fixed: v })} error={errors.discount_value} />
              )}
              {isBundle && (
                <>
                  {/* Stacked until there is room: in the narrow form column side-by-side labels and hints wrap and misalign the inputs. */}
                  <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                    <NumberInput label="Tickets in a group" description="Use 2 for a couple" withAsterisk min={2} max={10} allowDecimal={false} value={form.groupSize}
                      onChange={(v) => patch({ groupSize: v })} error={errors.group_size} />
                    <NumberInput label="Price for the whole group" description="Paid for the whole group" placeholder={currencyExponent(currency) > 0 ? "0.00" : "0"} withAsterisk {...moneyInputProps(currency)} prefix={`${currencySymbol(currency)} `} value={form.groupPrice}
                      onChange={(v) => patch({ groupPrice: v })} error={errors.group_price_minor} />
                  </SimpleGrid>
                  <Text size="xs" c="dimmed">
                    Each group is made of tickets of the same ticket type and option; different ticket types never make a group together. Tickets left over after the last full group are charged the normal price. Every person still gets their own ticket and QR code.
                  </Text>
                </>
              )}
              {!isBundle && (
                <Stack gap="xs">
                  <Checkbox label="Only when buying a minimum number of the same ticket" checked={form.minQuantity !== ""} disabled={!!initial?.is_locked}
                    onChange={(e) => patch({ minQuantity: e.currentTarget.checked ? 3 : "" })} />
                  {form.minQuantity !== "" && (
                    <NumberInput label="Minimum tickets of one type" description="Once a cart has this many of one ticket type, every ticket of that type gets the discount." min={2} max={10} allowDecimal={false}
                      value={form.minQuantity} onChange={(v) => patch({ minQuantity: v })} error={errors.min_ticket_quantity} />
                  )}
                </Stack>
              )}
              <Text size="sm" c="dimmed" aria-live="polite">
                {isBundle
                  ? exampleBundle && groupPriceMinor > 0
                    ? `${groupSize} × ${formatMinorAmount(examplePrice, currency)} tickets cost ${formatMinorAmount(exampleBundle.groupMinor, currency)} together${exampleBundle.savingMinor > 0 ? ` — buyers save ${formatMinorAmount(exampleBundle.savingMinor, currency)} per group.` : "."}`
                    : "Enter the group size and price to see an example."
                  : discountValue > 0
                    ? `A ${formatMinorAmount(examplePrice, currency)} ticket becomes ${exampleFinal === 0 ? "free" : formatMinorAmount(exampleFinal, currency)}${minQuantity ? ` when buying ${minQuantity} or more` : ""}.`
                    : "Enter a discount to see an example."}
                {form.discountType === "FIXED_PER_TICKET" ? " A ticket never goes below zero." : ""}
              </Text>
              {bundleNotCheaper && (
                <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} title="Not a discount">
                  The group price isn’t lower than buying {groupSize} tickets separately, so it can’t be activated. Lower the group price.
                </Alert>
              )}
              {conditionalFree && (
                <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} title="Tickets would be free">
                  Offers that need a minimum or a group can’t make a ticket free. {isBundle ? "Raise the group price." : "Reduce the discount."}
                </Alert>
              )}
              {(bundleCliff || volumeCliff) && !conditionalFree && (
                <Alert color="yellow" variant="light" icon={<IconInfoCircle size={18} />} title="Buying more costs less than buying fewer">
                  {isBundle
                    ? `${groupSize} tickets would cost less than ${groupSize - 1}. That’s allowed, but check it’s what you want.`
                    : `${minQuantity} tickets would cost less than ${(minQuantity ?? 2) - 1}. That’s allowed, but check it’s what you want.`}
                </Alert>
              )}
            </Section>

            <Section title="3. Which tickets">
              {inventory.length === 0 && <Alert color="blue" icon={<IconInfoCircle size={18} />}>Create a ticket type first, then come back to add an offer.</Alert>}
              <Stack gap="sm">
                {inventory.map((type) => {
                  const wholeKey = scopeKey.product(type.productId);
                  const whole = !!form.scope[wholeKey];
                  return (
                    <Stack key={type.productId} gap={6}>
                      <Checkbox
                        label={<Text fw={600} size="sm">{type.tiered ? `${type.title} — all options` : type.title}</Text>}
                        description={type.priceMinor !== null ? formatMinorAmount(type.priceMinor, currency) : undefined}
                        checked={whole}
                        onChange={(e) => patch({ scope: { ...form.scope, [wholeKey]: e.currentTarget.checked } })}
                      />
                      {type.tiered && (
                        <Stack gap={6} pl="xl">
                          {type.options.map((option) => (
                            <Checkbox key={option.id} size="sm" label={option.name} description={formatMinorAmount(option.priceMinor, currency)}
                              checked={whole || !!form.scope[scopeKey.option(type.productId, option.id)]} disabled={whole}
                              onChange={(e) => patch({ scope: { ...form.scope, [scopeKey.option(type.productId, option.id)]: e.currentTarget.checked } })} />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  );
                })}
              </Stack>
              {errors.scope && <Text size="sm" c="var(--mantine-color-error)" role="alert">{errors.scope}</Text>}
              <Text size="xs" c="dimmed">
                {isBundle || minQuantity !== null
                  ? "Pick the ticket type (or option) the deal is for. Tickets are only counted together when they are the same type and option."
                  : "Pick specific options to leave others out — for example, keep your Early Bird price as it is."}
              </Text>
            </Section>

            <Section title="4. When and how many">
              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                <TextInput type="datetime-local" label="Starts" withAsterisk value={form.starts}
                  onChange={(e) => { patch({ starts: e.currentTarget.value }); setScheduleErrors((s) => ({ ...s, start: null })); }}
                  onBlur={() => setScheduleErrors({ start: startError(form.starts, timezone, { unchangedFrom: initialStart }), end: form.ends ? endError(form.starts, form.ends, timezone) : null })}
                  error={scheduleErrors.start ?? errors.starts_at} />
                <TextInput type="datetime-local" label="Ends" withAsterisk value={form.ends}
                  onChange={(e) => { patch({ ends: e.currentTarget.value }); setScheduleErrors((s) => ({ ...s, end: null })); }}
                  onBlur={() => setScheduleErrors((s) => ({ ...s, end: endError(form.starts, form.ends, timezone) }))}
                  error={scheduleErrors.end ?? errors.ends_at} />
              </SimpleGrid>
              <Text size="xs" c="dimmed">Times are in the event’s timezone ({offerTimezoneLabel(timezone)}).</Text>
              <NumberInput label="Total discounted tickets (optional)" description={isBundle ? `The most tickets that can ever get the group price (e.g. 100 groups = ${100 * groupSizeForCopy} tickets). Leave empty for no limit.` : "The most tickets that can ever get this discount. Leave empty for no limit."} min={1} allowDecimal={false}
                value={form.globalLimit} onChange={(v) => patch({ globalLimit: v })} error={errors.global_ticket_limit ?? (limitTooSmall(form.globalLimit) ? `Must be at least ${condition}.` : undefined)} />
              {isBundle && (
                <NumberInput label="Groups per order (optional)"
                  description={`1 = only the first ${groupSizeForCopy} tickets in an order get the group price; any more are charged the normal price. Leave empty for no limit.`}
                  min={1} max={1000} allowDecimal={false} value={form.maxGroups} onChange={(v) => patch({ maxGroups: v })} error={errors.max_groups_per_order} />
              )}
              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                <NumberInput label="Per customer (optional)" description="Discounted tickets one customer can buy." min={1} allowDecimal={false}
                  value={form.perCustomer} onChange={(v) => patch({ perCustomer: v })} error={errors.per_customer_ticket_limit ?? (limitTooSmall(form.perCustomer) ? `Must be at least ${condition}.` : undefined)} />
                <NumberInput label="Per order (optional)" description="Discounted tickets in a single order." min={1} allowDecimal={false}
                  value={form.perOrder} onChange={(v) => patch({ perOrder: v })} error={errors.per_order_ticket_limit ?? (limitTooSmall(form.perOrder) ? `Must be at least ${condition}.` : undefined)} />
              </SimpleGrid>
              <Text size="xs" c="dimmed">Limits count discounted tickets, not orders{isBundle ? ", and only whole groups count" : ""}. Anything above a limit is simply charged at the regular price.</Text>
              {(isBundle || minQuantity !== null) && form.globalLimit === "" && (
                <Alert color="yellow" variant="light" icon={<IconInfoCircle size={18} />}>No total limit is set, so buyers can place any number of separate orders at this price. Consider a total limit.</Alert>
              )}
              {form.perCustomer !== "" && (
                <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />}>Buyers will verify their email with a one-time code before this offer applies.</Alert>
              )}
            </Section>

            {automaticActive && (
              <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Another automatic offer is active">
                “{automaticActive.name}” is already active. Only one automatic offer can run at a time, so pause it before you activate this one.
              </Alert>
            )}
            {overlapping.length > 0 && (
              <Alert color="yellow" icon={<IconInfoCircle size={18} />} title="Overlaps with another offer">
                {overlapping.map((o) => `“${o.name}”`).join(", ")} also cover{overlapping.length === 1 ? "s" : ""} some of these tickets. A buyer only ever gets one discount — whichever saves them more.
              </Alert>
            )}

            <Group justify="space-between" wrap="wrap-reverse">
              <Button component={Link} href={initial ? `/events/${eventId}/offers/${initial.id}` : `/events/${eventId}/offers`} variant="subtle" color="gray" disabled={mutation.isPending}>Cancel</Button>
              <Button type="submit" loading={mutation.isPending} disabled={!canSubmit || inventory.length === 0}>{initial ? "Save changes" : "Save as draft"}</Button>
            </Group>
          </Stack>
        </form>
      </GridCol>

      <GridCol span={{ base: 12, md: 5 }}>
        <Box pos={{ base: "static", md: "sticky" }} top={84}>
          <Preview form={form} currency={currency} timezone={timezone} labels={scopeLabels(scopeRows, inventory)} examplePrice={examplePrice} exampleFinal={exampleFinal}
            exampleQuantity={exampleQuantity} exampleBundle={exampleBundle} hasDeal={hasDeal} label={previewLabel} publicEventPath={publicEventPath} />
        </Box>
      </GridCol>
    </Grid>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="md">
      <Title order={3} fz={18}>{title}</Title>
      <Stack gap="md">{children}</Stack>
    </Stack>
  );
}

/** How buyers will see the offer: the ticket row badge and the checkout lines. */
function Preview({ form, currency, timezone, labels, examplePrice, exampleFinal, exampleQuantity, exampleBundle, hasDeal, label }: {
  form: FormState; currency: string; timezone: string; labels: string[]; examplePrice: number; exampleFinal: number; exampleQuantity: number;
  exampleBundle: { normalMinor: number; groupMinor: number; savingMinor: number } | null; hasDeal: boolean; label: string; publicEventPath?: string;
}) {
  const endsText = form.ends ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(localInputToUtcIso(form.ends, timezone))) : "";
  const gross = examplePrice * exampleQuantity;
  const net = exampleBundle ? exampleBundle.groupMinor : exampleFinal * exampleQuantity;
  const savings = hasDeal ? Math.max(0, gross - net) : 0;

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>How buyers see it</Text>
          <Badge variant="light" color="gray">Preview</Badge>
        </Group>

        <Card radius="md" p="md" bg="var(--mantine-color-grey-1)">
          <Stack gap={6}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" fw={500} c="var(--mantine-color-grey-9)">{labels[0] ?? "General admission"}</Text>
              <Text size="sm" fw={500} c="var(--mantine-color-grey-9)">{formatMinorAmount(examplePrice, currency)}</Text>
            </Group>
            <Text size="xs" fw={600} c="#18794e">{label} · ends {endsText || "—"}</Text>
          </Stack>
        </Card>

        <Stack gap={6}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>At checkout</Text>
          <Group justify="space-between"><Text size="sm" c="dimmed">{exampleQuantity} × ticket</Text><Text size="sm">{formatMinorAmount(gross, currency)}</Text></Group>
          {savings > 0 && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Discount{form.name ? ` (${form.name})` : ""}</Text>
              <Text size="sm" fw={600} c="light-dark(#18794e, #5fd39a)">−{formatMinorAmount(savings, currency)}</Text>
            </Group>
          )}
          <Group justify="space-between"><Text size="sm" fw={600}>{exampleQuantity > 1 ? "Tickets total" : "Ticket price"}</Text><Text size="sm" fw={600}>{hasDeal && net === 0 ? "Free" : formatMinorAmount(hasDeal ? net : gross, currency)}</Text></Group>
        </Stack>

        <Text size="xs" c="dimmed">
          Your payout is calculated on the discounted price, and Mefie’s fees are calculated on it too. The offer name appears on buyers’ receipts — never the code.
        </Text>
      </Stack>
    </Card>
  );
}
