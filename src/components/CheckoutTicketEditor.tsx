"use client";

import { useMemo, useState } from "react";
import { Alert, Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import { TicketSelector, ticketLineKey } from "@/components/TicketSelector";
import type { PublicEvent } from "@/lib/publicEventApi";
import type { StoredCartItem } from "@/lib/cartStorage";
import {
  planCartReconciliation,
  type AttendeeSlot,
  type CheckoutCartLine,
  type ReconciliationPlan,
} from "@/lib/checkoutDraft";

type PendingRemoval = {
  cart: StoredCartItem[];
  lines: CheckoutCartLine[];
  plan: ReconciliationPlan;
};

function attendeeLabel(slot: AttendeeSlot): string {
  if (slot.assignment === "me") return `Me — ${slot.product_title}`;
  const name = `${slot.guestFirstName} ${slot.guestLastName}`.trim();
  return `${name || "Attendee entry"} — ${slot.product_title}`;
}

export function CheckoutTicketEditor({
  opened,
  event,
  cart,
  slots,
  onClose,
  onSave,
}: {
  opened: boolean;
  event: PublicEvent;
  cart: StoredCartItem[];
  slots: AttendeeSlot[];
  onClose: () => void;
  onSave: (cart: StoredCartItem[], removedAuthoredIds: string[]) => void;
}) {
  const initialQuantities = useMemo(
    () => Object.fromEntries(cart.map((line) => [ticketLineKey(line.product_id, line.ticket_option_id), line.quantity])),
    [cart],
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities);
  const [pending, setPending] = useState<PendingRemoval | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function close() {
    setQuantities(initialQuantities);
    setPending(null);
    setSelected(new Set());
    onClose();
  }

  function buildCart(): { stored: StoredCartItem[]; lines: CheckoutCartLine[] } {
    const lines = event.products.flatMap((product) => {
      const options = product.type === "TIERED" ? (product.options ?? []) : [null];
      return options.flatMap((option) => {
        const optionId = option?.id ?? null;
        const quantity = quantities[ticketLineKey(product.id, optionId)] ?? 0;
        if (quantity <= 0) return [];
        return [{
          product_id: product.id,
          ticket_option_id: optionId,
          quantity,
          product_title: option ? `${product.title} — ${option.name}` : product.title,
        } satisfies CheckoutCartLine];
      });
    });
    return {
      lines,
      stored: lines.map(({ product_id, ticket_option_id, quantity }) => ({ product_id, ticket_option_id, quantity })),
    };
  }

  function beginSave() {
    const next = buildCart();
    if (next.stored.length === 0) return;
    const plan = planCartReconciliation(slots, next.lines);
    if (plan.authoredGroups.length === 0) {
      onSave(next.stored, []);
      close();
      return;
    }
    const forced = plan.authoredGroups.flatMap((group) =>
      group.removalCount === group.candidates.length ? group.candidates.map((slot) => slot.clientId) : [],
    );
    setSelected(new Set(forced));
    setPending({ cart: next.stored, lines: next.lines, plan });
  }

  const selectionsValid = pending?.plan.authoredGroups.every((group) => {
    const selectedCount = group.candidates.filter((slot) => selected.has(slot.clientId)).length;
    return selectedCount === group.removalCount;
  }) ?? false;

  return (
    <Modal opened={opened} onClose={close} title={pending ? "Choose attendee entries to remove" : "Edit tickets"} size="lg">
      {!pending ? (
        <Stack>
          <TicketSelector
            products={event.products}
            quantities={quantities}
            onQuantityChange={(productId, optionId, quantity) =>
              setQuantities((current) => ({ ...current, [ticketLineKey(productId, optionId)]: quantity }))
            }
            currencyCode={event.currency_code}
          />
          {Object.values(quantities).every((quantity) => quantity <= 0) && (
            <Alert color="orange">Select at least one ticket to continue.</Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>Cancel</Button>
            <Button onClick={beginSave} disabled={Object.values(quantities).every((quantity) => quantity <= 0)}>Save tickets</Button>
          </Group>
        </Stack>
      ) : (
        <Stack>
          <Alert color="orange">
            Reducing these quantities will remove attendee work. Untouched ticket slots are removed automatically.
          </Alert>
          {pending.plan.authoredGroups.map((group) => {
            const fixed = group.removalCount === group.candidates.length;
            return (
              <Stack key={group.lineKey} gap="xs">
                <Text fw={600} size="sm">
                  {fixed
                    ? `Confirm removal of ${group.removalCount} attendee ${group.removalCount === 1 ? "entry" : "entries"}`
                    : `Choose ${group.removalCount} attendee ${group.removalCount === 1 ? "entry" : "entries"} to remove`}
                </Text>
                {group.candidates.map((slot) => (
                  <Checkbox
                    key={slot.clientId}
                    checked={selected.has(slot.clientId)}
                    disabled={fixed}
                    label={attendeeLabel(slot)}
                    onChange={(event) => setSelected((current) => {
                      const next = new Set(current);
                      if (event.currentTarget.checked) next.add(slot.clientId);
                      else next.delete(slot.clientId);
                      return next;
                    })}
                  />
                ))}
              </Stack>
            );
          })}
          <Group justify="space-between">
            <Button variant="subtle" onClick={() => { setPending(null); setSelected(new Set()); }}>Back</Button>
            <Group>
              <Button variant="default" onClick={close}>Cancel</Button>
              <Button color="red" disabled={!selectionsValid} onClick={() => {
                onSave(pending.cart, [...selected]);
                close();
              }}>Remove and save</Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
