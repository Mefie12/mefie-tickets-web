"use client";

import type { ComponentType } from "react";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandTelegram,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconBrandX,
  IconMail,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { SHARE_CHANNELS, shareIntentUrl, taggedShortUrl, type ShareChannelCode } from "@/lib/shortLink";

const ICONS: Record<ShareChannelCode, ComponentType<{ size?: number }>> = {
  wa: IconBrandWhatsapp,
  fb: IconBrandFacebook,
  x: IconBrandX,
  tg: IconBrandTelegram,
  li: IconBrandLinkedin,
  em: IconMail,
  ig: IconBrandInstagram,
  tt: IconBrandTiktok,
};

/**
 * One button per share channel (docs/26, Phase 2). Each shares the short link
 * tagged with `?c={channel}`, so the API counts the click under that channel
 * and adds the matching UTM tags to the destination. Platforms without a web
 * share link (Instagram, TikTok) copy the tagged link to paste into a bio or
 * story. Plain anchors for the web share links: no async work before opening,
 * so popup blockers never interfere.
 */
export function ShareChannelButtons({ shortUrl, title, text, disabled = false }: { shortUrl: string; title: string; text?: string; disabled?: boolean }) {
  async function copyTagged(code: ShareChannelCode, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(taggedShortUrl(shortUrl, code));
      notifications.show({ color: "teal", message: `Link for ${label} copied. Paste it into your bio or story.` });
    } catch {
      notifications.show({ color: "red", message: "Could not copy the link. Select it and copy it manually." });
    }
  }

  return (
    <Group gap="xs" wrap="wrap">
      {SHARE_CHANNELS.map((channel) => {
        const Icon = ICONS[channel.code];
        const href = channel.kind === "intent" ? shareIntentUrl(channel.code, taggedShortUrl(shortUrl, channel.code), title, text) : null;
        const label = channel.kind === "intent" ? `Share on ${channel.label}` : `Copy a link for ${channel.label}`;
        return (
          <Tooltip key={channel.code} label={label} withArrow>
            {href ? (
              <ActionIcon component="a" href={disabled ? undefined : href} target="_blank" rel="noopener noreferrer" variant="default" size={40} radius="md" aria-label={label} aria-disabled={disabled} data-disabled={disabled || undefined}>
                <Icon size={20} />
              </ActionIcon>
            ) : (
              <ActionIcon variant="default" size={40} radius="md" aria-label={label} disabled={disabled} onClick={() => void copyTagged(channel.code, channel.label)}>
                <Icon size={20} />
              </ActionIcon>
            )}
          </Tooltip>
        );
      })}
    </Group>
  );
}
