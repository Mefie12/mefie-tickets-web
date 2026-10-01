"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Alert, Stack, Text, Textarea } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconLock } from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { deleteOffer, offerAction, type Offer, type OfferAction } from "@/lib/offersApi";
import { offerErrorMessage } from "@/lib/offerErrors";
import { discountLabel } from "@/lib/offerFormat";
import { scopeLabels, type OfferTicketType } from "@/lib/offerInventory";
import { formatEventDateTime } from "@/lib/eventDateTime";

/**
 * The state-changing actions on an offer (activate / pause / resume / end /
 * delete) with their confirmation dialogs, shared by the offer page and the
 * list's row menu so both behave — and read — identically. Every action goes
 * through the API, which enforces the real rules (state machine, locking,
 * fee floor); the UI only decides which ones to offer.
 */
export function useOfferActions({ eventId, timezone, inventory, onDeleted }: {
  eventId: number;
  timezone: string;
  inventory: OfferTicketType[];
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const refresh = (offerId: number) => {
    void queryClient.invalidateQueries({ queryKey: ["offer", eventId, offerId] });
    void queryClient.invalidateQueries({ queryKey: ["offers", eventId] });
    router.refresh();
  };

  const act = useMutation({
    mutationFn: ({ offerId, action, reason }: { offerId: number; action: OfferAction; reason?: string }) => offerAction(eventId, offerId, action, reason),
    onSuccess: (_, { offerId, action }) => {
      notifications.show({ color: "teal", message: { activate: "Offer is live.", pause: "Offer paused.", resume: "Offer resumed.", end: "Offer ended." }[action] });
      refresh(offerId);
    },
    onError: (error: Error) => {
      const code = error instanceof ApiError ? error.code : undefined;
      notifications.show({ color: "red", title: "Couldn’t update the offer", message: offerErrorMessage(code, error.message), autoClose: 8000 });
    },
  });

  const remove = useMutation({
    mutationFn: (offerId: number) => deleteOffer(eventId, offerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["offers", eventId] });
      notifications.show({ color: "teal", message: "Draft deleted." });
      onDeleted?.();
      router.refresh();
    },
    onError: (error: Error) => notifications.show({ color: "red", message: offerErrorMessage(error instanceof ApiError ? error.code : undefined, error.message) }),
  });

  function activate(offer: Offer) {
    modals.openConfirmModal({
      title: "Make this offer live?",
      centered: true,
      labels: { confirm: "Activate offer", cancel: "Not yet" },
      children: (
        <Stack gap="sm">
          <Text size="sm">{offer.name} — {discountLabel(offer)} on {scopeLabels(offer.scope ?? [], inventory).join(", ") || "no tickets"}.</Text>
          <Text size="sm">Starts {formatEventDateTime(offer.starts_at, timezone)} and ends {formatEventDateTime(offer.ends_at, timezone)}.</Text>
          <Alert color="yellow" variant="light" icon={<IconLock size={16} />}>
            Once active, the discount, tickets, dates, limits and code can’t be changed. You can still pause or end the offer at any time.
          </Alert>
        </Stack>
      ),
      onConfirm: () => act.mutate({ offerId: offer.id, action: "activate" }),
    });
  }

  function withReason(offer: Offer, action: "pause" | "end") {
    let reason = "";
    modals.openConfirmModal({
      title: action === "pause" ? "Pause this offer?" : "End this offer for good?",
      centered: true,
      labels: { confirm: action === "pause" ? "Pause offer" : "End offer", cancel: "Keep it" },
      confirmProps: { color: action === "end" ? "red" : undefined },
      children: (
        <Stack gap="sm">
          <Text size="sm">
            {action === "pause"
              ? "New customers won’t be able to use it. People already in checkout can finish their purchase. You can resume it whenever you like."
              : "Nobody will be able to use it any more, and it can’t be reopened. People already in checkout can finish. Past orders and results are kept."}
          </Text>
          <Textarea label="Reason (optional)" description="Recorded in the activity log." autosize minRows={2} maxLength={500} onChange={(e) => { reason = e.currentTarget.value; }} />
        </Stack>
      ),
      onConfirm: () => act.mutate({ offerId: offer.id, action, reason: reason.trim() || undefined }),
    });
  }

  function confirmDelete(offer: Offer) {
    modals.openConfirmModal({
      title: "Delete this draft?", centered: true, labels: { confirm: "Delete draft", cancel: "Keep it" }, confirmProps: { color: "red" },
      children: <Text size="sm">“{offer.name}” hasn’t been used by anyone. Deleting it can’t be undone.</Text>,
      onConfirm: () => remove.mutate(offer.id),
    });
  }

  return {
    activate,
    pause: (offer: Offer) => withReason(offer, "pause"),
    end: (offer: Offer) => withReason(offer, "end"),
    resume: (offer: Offer) => act.mutate({ offerId: offer.id, action: "resume" }),
    remove: confirmDelete,
    busy: act.isPending || remove.isPending,
  };
}
