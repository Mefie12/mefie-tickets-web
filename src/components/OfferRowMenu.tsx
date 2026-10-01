"use client";

import Link from "next/link";
import { ActionIcon, Menu } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconCopy, IconDotsVertical, IconExternalLink, IconLink, IconPencil, IconPlayerPause, IconPlayerPlay, IconPlayerStop, IconRocket, IconTrash } from "@tabler/icons-react";
import type { Offer } from "@/lib/offersApi";
import { shareUrl } from "@/lib/offerFormat";
import type { OfferTicketType } from "@/lib/offerInventory";
import { useOfferActions } from "@/lib/useOfferActions";

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    notifications.show({ color: "teal", icon: <IconCheck size={16} />, message: `${what} copied.` });
  } catch {
    notifications.show({ color: "red", message: `Couldn’t copy the ${what.toLowerCase()}. Copy it from the offer page instead.` });
  }
}

/**
 * The ⋮ menu on each row of the offers list. It only offers what the offer's
 * status allows (the API enforces the same rules): drafts can be edited,
 * activated or deleted; active offers paused or ended; paused ones resumed or
 * ended; anything can be opened, duplicated, or have its code / link copied.
 */
export function OfferRowMenu({ offer, eventId, timezone, inventory, publicEventPath, canManage }: {
  offer: Offer;
  eventId: number;
  timezone: string;
  inventory: OfferTicketType[];
  publicEventPath: string;
  canManage: boolean;
}) {
  const actions = useOfferActions({ eventId, timezone, inventory });
  const base = `/events/${eventId}/offers/${offer.id}`;
  const hasCode = offer.activation === "CODE" && !!offer.code;
  const hasLink = offer.activation === "CODE" && !!offer.share_token;

  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={230} disabled={actions.busy}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label={`Actions for ${offer.name}`} loading={actions.busy}>
          <IconDotsVertical size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item component={Link} href={base} leftSection={<IconExternalLink size={16} />}>Open</Menu.Item>
        {canManage && offer.status === "DRAFT" && (
          <Menu.Item component={Link} href={`${base}?edit=1`} leftSection={<IconPencil size={16} />}>Edit</Menu.Item>
        )}
        {canManage && (
          <Menu.Item component={Link} href={`/events/${eventId}/offers/new?from=${offer.id}`} leftSection={<IconCopy size={16} />}>Duplicate</Menu.Item>
        )}

        {(hasCode || hasLink) && <Menu.Divider />}
        {hasCode && <Menu.Item leftSection={<IconCopy size={16} />} onClick={() => void copy(offer.code as string, "Promo code")}>Copy code</Menu.Item>}
        {hasLink && (
          <Menu.Item leftSection={<IconLink size={16} />} onClick={() => void copy(shareUrl(`${window.location.origin}${publicEventPath}`, offer.share_token as string), "Share link")}>
            Copy share link
          </Menu.Item>
        )}

        {canManage && offer.status !== "ENDED" && <Menu.Divider />}
        {canManage && offer.status === "DRAFT" && (
          <Menu.Item leftSection={<IconRocket size={16} />} disabled={(offer.scope ?? []).length === 0} onClick={() => actions.activate(offer)}>Activate…</Menu.Item>
        )}
        {canManage && offer.status === "ACTIVE" && (
          <Menu.Item leftSection={<IconPlayerPause size={16} />} onClick={() => actions.pause(offer)}>Pause…</Menu.Item>
        )}
        {canManage && offer.status === "PAUSED" && (
          <Menu.Item leftSection={<IconPlayerPlay size={16} />} onClick={() => actions.resume(offer)}>Resume</Menu.Item>
        )}
        {canManage && (offer.status === "ACTIVE" || offer.status === "PAUSED") && (
          <Menu.Item color="red" leftSection={<IconPlayerStop size={16} />} onClick={() => actions.end(offer)}>End…</Menu.Item>
        )}
        {canManage && offer.status === "DRAFT" && (
          <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={() => actions.remove(offer)}>Delete…</Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
