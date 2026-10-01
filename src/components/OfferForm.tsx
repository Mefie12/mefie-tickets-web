"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Box, Button, Card, Checkbox, Grid, GridCol, Group, NumberInput, SegmentedControl, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconInfoCircle, IconRefresh } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { createOffer, updateOffer, type Offer, type OfferActivation, type OfferDiscountType, type OfferInput, type OfferScopeRow } from "@/lib/offersApi";
import { offerErrorMessage } from "@/lib/offerErrors";
import { discountLabel, previewDiscountedUnit } from "@/lib/offerFormat";
import { localInputToUtcIso, utcIsoToLocalInput } from "@/lib/offerDates";
import { samplePriceMinor, scopeLabels, type OfferTicketType } from "@/lib/offerInventory";
import { currencySymbol, formatMinorAmount } from "@/lib/money";
import { offerTimezoneLabel } from "@/lib/offerTimezone";
import { normalizePromoCode, promoCodeFormatError } from "@/lib/offerCodeFormat";
import { endError, startError } from "@/lib/offerSchedule";

type Template = "percent" | "fixed" | "automatic";

type FormState = {
  name: string;
  description: string;
  activation: OfferActivation;
  code: string;
  discountType: OfferDiscountType;
  percent: number | string;
  fixed: number | string;
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

function initialState(args: { initial?: Offer; template?: Template; timezone: string; eventStart: string | null }): FormState {
  const { initial, template, timezone, eventStart } = args;
  if (initial) {
    return {
      name: initial.name,
      description: initial.internal_description ?? "",
      activation: initial.activation,
      code: initial.code ?? "",
      discountType: initial.discount_type,
      percent: initial.discount_type === "PERCENTAGE" ? initial.discount_value / 100 : 10,
      fixed: initial.discount_type === "FIXED_PER_TICKET" ? initial.discount_value / 100 : "",
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
    name: template === "automatic" ? "Limited-time sale" : "",
    description: "",
    activation: template === "automatic" ? "AUTOMATIC" : "CODE",
    code: "",
    discountType: template === "fixed" ? "FIXED_PER_TICKET" : "PERCENTAGE",
    percent: template === "automatic" ? 15 : 20,
    fixed: "",
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
export function OfferForm({ eventId, currency, timezone, eventStart, inventory, otherOffers, initial, template, publicEventPath, onSaved }: {
  eventId: number;
  currency: string;
  timezone: string;
  eventStart: string | null;
  inventory: OfferTicketType[];
  otherOffers: Offer[];
  initial?: Offer;
  template?: Template;
  publicEventPath?: string;
  /** Edit mode: called after a successful save so the host can leave edit mode (the URL doesn't change). */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialState({ initial, template, timezone, eventStart }));
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
  const discountValue = form.discountType === "PERCENTAGE"
    ? Math.round(Number(form.percent || 0) * 100)
    : Math.round(Number(form.fixed || 0) * 100);

  const samplePrice = samplePriceMinor(scopeRows, inventory);
  const examplePrice = samplePrice ?? 10_000;
  const exampleFinal = previewDiscountedUnit(examplePrice, { discount_type: form.discountType, discount_value: discountValue });

  const overlapping = otherOffers.filter((o) => o.id !== initial?.id && (o.status === "ACTIVE" || o.status === "PAUSED") && (o.scope ?? []).some((row) =>
    scopeRows.some((mine) => mine.product_id === row.product_id && (mine.ticket_option_id === null || row.ticket_option_id === null || mine.ticket_option_id === row.ticket_option_id))));
  const automaticActive = form.activation === "AUTOMATIC"
    ? otherOffers.find((o) => o.id !== initial?.id && o.activation === "AUTOMATIC" && o.status === "ACTIVE")
    : undefined;

  const mutation = useMutation({
    mutationFn: () => {
      const input: OfferInput = {
        name: form.name.trim(),
        internal_description: form.description.trim() || null,
        activation: form.activation,
        starts_at: localInputToUtcIso(form.starts, timezone),
        ends_at: localInputToUtcIso(form.ends, timezone),
        discount_type: form.discountType,
        discount_value: discountValue,
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

  const canSubmit = form.name.trim() !== "" && discountValue > 0 && form.starts !== "" && form.ends !== "";

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
                data={[{ value: "PERCENTAGE", label: "Percentage off" }, { value: "FIXED_PER_TICKET", label: "Fixed amount off each ticket" }]} aria-label="Discount type" disabled={!!initial?.is_locked} />
              {form.discountType === "PERCENTAGE" ? (
                <NumberInput label="Percentage" withAsterisk min={0.01} max={100} decimalScale={2} suffix="%" value={form.percent}
                  onChange={(v) => patch({ percent: v })} error={errors.discount_value} />
              ) : (
                <NumberInput label="Amount off each ticket" withAsterisk min={0.01} decimalScale={2} fixedDecimalScale prefix={`${currencySymbol(currency)} `} value={form.fixed}
                  onChange={(v) => patch({ fixed: v })} error={errors.discount_value} />
              )}
              <Text size="sm" c="dimmed" aria-live="polite">
                {discountValue > 0
                  ? `A ${formatMinorAmount(examplePrice, currency)} ticket becomes ${exampleFinal === 0 ? "free" : formatMinorAmount(exampleFinal, currency)}.`
                  : "Enter a discount to see an example."}
                {form.discountType === "FIXED_PER_TICKET" ? " A ticket never goes below zero." : ""}
              </Text>
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
              <Text size="xs" c="dimmed">Pick specific options to leave others out — for example, keep your Early Bird price as it is.</Text>
            </Section>

            <Section title="4. When and how many">
              <Group grow align="flex-start">
                <TextInput type="datetime-local" label="Starts" withAsterisk value={form.starts}
                  onChange={(e) => { patch({ starts: e.currentTarget.value }); setScheduleErrors((s) => ({ ...s, start: null })); }}
                  onBlur={() => setScheduleErrors({ start: startError(form.starts, timezone, { unchangedFrom: initialStart }), end: form.ends ? endError(form.starts, form.ends, timezone) : null })}
                  error={scheduleErrors.start ?? errors.starts_at} />
                <TextInput type="datetime-local" label="Ends" withAsterisk value={form.ends}
                  onChange={(e) => { patch({ ends: e.currentTarget.value }); setScheduleErrors((s) => ({ ...s, end: null })); }}
                  onBlur={() => setScheduleErrors((s) => ({ ...s, end: endError(form.starts, form.ends, timezone) }))}
                  error={scheduleErrors.end ?? errors.ends_at} />
              </Group>
              <Text size="xs" c="dimmed">Times are in the event’s timezone ({offerTimezoneLabel(timezone)}).</Text>
              <NumberInput label="Total discounted tickets (optional)" description="The most tickets that can ever get this discount. Leave empty for no limit." min={1} allowDecimal={false}
                value={form.globalLimit} onChange={(v) => patch({ globalLimit: v })} error={errors.global_ticket_limit} />
              <Group grow align="flex-start">
                <NumberInput label="Per customer (optional)" description="Discounted tickets one customer can buy." min={1} allowDecimal={false}
                  value={form.perCustomer} onChange={(v) => patch({ perCustomer: v })} error={errors.per_customer_ticket_limit} />
                <NumberInput label="Per order (optional)" description="Discounted tickets in a single order." min={1} allowDecimal={false}
                  value={form.perOrder} onChange={(v) => patch({ perOrder: v })} error={errors.per_order_ticket_limit} />
              </Group>
              <Text size="xs" c="dimmed">Limits count discounted tickets, not orders. Anything above a limit is simply charged at the regular price.</Text>
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
            discountValue={discountValue} publicEventPath={publicEventPath} />
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
function Preview({ form, currency, timezone, labels, examplePrice, exampleFinal, discountValue }: {
  form: FormState; currency: string; timezone: string; labels: string[]; examplePrice: number; exampleFinal: number; discountValue: number; publicEventPath?: string;
}) {
  const label = discountValue > 0
    ? discountLabel({ discount_type: form.discountType, discount_value: discountValue, currency_code: currency })
    : "—";
  const endsText = form.ends ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(localInputToUtcIso(form.ends, timezone))) : "";
  const savings = examplePrice - exampleFinal;

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
          <Group justify="space-between"><Text size="sm" c="dimmed">1 × ticket</Text><Text size="sm">{formatMinorAmount(examplePrice, currency)}</Text></Group>
          {savings > 0 && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Discount{form.name ? ` (${form.name})` : ""}</Text>
              <Text size="sm" fw={600} c="light-dark(#18794e, #5fd39a)">−{formatMinorAmount(savings, currency)}</Text>
            </Group>
          )}
          <Group justify="space-between"><Text size="sm" fw={600}>Ticket price</Text><Text size="sm" fw={600}>{exampleFinal === 0 ? "Free" : formatMinorAmount(exampleFinal, currency)}</Text></Group>
        </Stack>

        <Text size="xs" c="dimmed">
          Your payout is calculated on the discounted price, and Mefie’s fees are calculated on it too. The offer name appears on buyers’ receipts — never the code.
        </Text>
      </Stack>
    </Card>
  );
}
