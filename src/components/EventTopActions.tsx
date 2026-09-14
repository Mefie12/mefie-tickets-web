"use client";

import Link from "next/link";
import { Button, Group, Text } from "@mantine/core";
import { IconArrowLeft, IconHeart, IconShare } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

/**
 * "Back to events" + Share (real Web Share API, clipboard fallback) +
 * Save. Save is decorative only — no favorites/saved-events feature
 * exists anywhere in the app yet, same treatment as the heart icon on
 * Discover's event cards. Not reusing PublicShareCard here: its
 * "compact" variant renders a full card (heading, public/private
 * badge, URL preview) — much heavier than this page's plain pill
 * button, so this owns a small, self-contained share/copy instead.
 */
export function EventTopActions({
  shareUrl,
  shareTitle,
  shareText,
}: {
  shareUrl: string;
  shareTitle: string;
  shareText: string;
}) {
  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      notifications.show({ color: "teal", message: "Link copied." });
    } catch {
      notifications.show({ color: "red", message: "Could not copy the link." });
    }
  }

  return (
    <Group justify="space-between" wrap="wrap" gap="sm">
      <Link href="/discover" style={{ textDecoration: "none", color: "inherit" }}>
        <Group gap={8}>
          <IconArrowLeft size={20} />
          <Text fw={500}>Back to events</Text>
        </Group>
      </Link>
      <Group gap={12}>
        <Button variant="default" leftSection={<IconShare size={18} />} onClick={share}>
          Share
        </Button>
        <Button variant="default" leftSection={<IconHeart size={18} />}>
          Save
        </Button>
      </Group>
    </Group>
  );
}
