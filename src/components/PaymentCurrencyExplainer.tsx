"use client";

import { useState } from "react";
import { Anchor, List, Modal, Stack, Text, Title } from "@mantine/core";

/**
 * The one explainer for "why is my event's currency fixed / why can't I
 * pick a currency here" — linked from both the payment setup screen
 * (PaymentsAndPayouts) and the event creation/edit screens' read-only
 * currency field, so an organizer gets the same answer wherever they
 * run into the fact. See EventService::resolveCurrencyCode() and
 * EventPaymentBindingService::bindForPaidSales() for the backend rules
 * this describes.
 */
export function PaymentCurrencyExplainer({ label = "Learn more" }: { label?: string }) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Anchor component="button" type="button" onClick={() => setOpened(true)}>
        {label}
      </Anchor>
      <Modal opened={opened} onClose={() => setOpened(false)} title="Why is my currency fixed?" size="lg">
        <Stack gap="md">
          <Text size="sm">
            Every event your organization creates sells tickets in the same currency — the one you set up (or will
            set up) for payments. You can&apos;t choose a different currency per event; this is deliberate, not a
            limitation of your account specifically.
          </Text>

          <Title order={5}>Why one currency for the whole organization?</Title>
          <Text size="sm">
            Your payout balance is tracked per payment account. If different events under the same organization sold
            in different currencies, there would be no single correct answer to &quot;how much do I have available to
            withdraw&quot; without mixing incompatible amounts together. Tying every event to one currency keeps that
            number always correct.
          </Text>

          <Title order={5}>What does &quot;minimal setup&quot; actually mean?</Title>
          <Text size="sm">
            Picking a legal country and currency is enough to start selling tickets right away — nothing else is
            required up front. Full identity verification is only ever required later, once you have real earnings to
            withdraw. This is deliberate: most organizers never get to try the platform if they have to complete a
            full verification process before making a single sale.
          </Text>

          <Title order={5}>What if I set up the wrong country or currency?</Title>
          <Text size="sm">
            If you haven&apos;t published a paid event yet, just replace your payment setup with the correct country
            and currency. If you have paid events live already, contact support — changing your settlement currency
            after real sales exist requires replacing the payment account, not editing it in place, so past orders
            keep reconciling correctly.
          </Text>

          <Title order={5}>Which currencies are supported?</Title>
          <List size="sm" spacing={4}>
            <List.Item>
              Generally, your country&apos;s own local currency — this covers the large majority of countries.
            </List.Item>
            <List.Item>
              A country/currency combination that isn&apos;t supported yet is rejected immediately when you try to
              set up payments, with a clear message — you won&apos;t discover this only after trying to sell tickets.
            </List.Item>
          </List>
        </Stack>
      </Modal>
    </>
  );
}
