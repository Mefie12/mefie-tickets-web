"use client";

import { useState, useSyncExternalStore } from "react";
import { Badge, Box, Button, Card, Group, Menu, Paper, Stack, Switch, Text, ThemeIcon } from "@mantine/core";
import { IconCheck, IconChevronDown, IconCopy, IconExternalLink, IconLink, IconShare } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import type { EventVisibility } from "@/lib/eventApi";
import { SHARE_CHANNELS, shareIntentUrl, taggedShortUrl, type ShareChannelCode, type ShortLinkTarget } from "@/lib/shortLink";
import { useShortLink } from "@/lib/useShortLink";

export type PublicShareCardProps = {
  url: string;
  title: string;
  text: string;
  enabled: boolean;
  disabledExplanation?: string;
  heading?: string;
  variant?: "feature" | "compact";
  /** Offers a "Shorten link" switch (docs/26) for this event / series. Omit for links that can't be shortened (e.g. the organization URL). */
  shortLink?: { target: ShortLinkTarget; id: number; visibility: EventVisibility };
};

// Which URL this organizer prefers to copy is a per-browser convenience only; the link itself lives on the server.
const preferenceKey = (target: ShortLinkTarget, id: number) => `mefie:short-link-pref:${target}:${id}`;
// Remembers the choice for this visit even when localStorage is blocked (private window).
const memoryPreference = new Map<string, boolean>();
const preferenceListeners = new Set<() => void>();

function readPreference(target: ShortLinkTarget, id: number): boolean {
  const key = preferenceKey(target, id);
  const remembered = memoryPreference.get(key);
  if (remembered !== undefined) return remembered;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writePreference(target: ShortLinkTarget, id: number, value: boolean): void {
  const key = preferenceKey(target, id);
  memoryPreference.set(key, value);
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Blocked storage: the in-memory value above still applies to this visit.
  }
  preferenceListeners.forEach((listener) => listener());
}

function subscribeToPreference(listener: () => void): () => void {
  preferenceListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function PublicShareCard({ url: longUrl, title, text, enabled, disabledExplanation, heading = "Your organization URL", variant = "feature", shortLink }: PublicShareCardProps) {
  const [copied, setCopied] = useState(false);
  const shortable = shortLink !== undefined && enabled && shortLink.visibility !== "INVITED";
  const short = useShortLink(shortLink?.target ?? "events", shortLink?.id ?? 0, shortable);
  // localStorage doesn't exist during server render, hence the external-store read with a `false` server snapshot.
  const preferShort = useSyncExternalStore(subscribeToPreference, () => (shortLink ? readPreference(shortLink.target, shortLink.id) : false), () => false);
  const shortActive = shortable && preferShort && short.link?.enabled === true;
  const url = shortActive && short.link ? short.link.short_url : longUrl;

  async function toggleShort(next: boolean): Promise<void> {
    if (!shortLink) return;
    writePreference(shortLink.target, shortLink.id, next);
    if (!next || short.link?.enabled) return;
    try {
      if (short.link?.disabled_by_admin) throw new Error("This short link has been disabled by the platform.");
      if (!short.link) await short.create.mutateAsync();
      else await short.update.mutateAsync({ enabled: true });
    } catch (error) {
      writePreference(shortLink.target, shortLink.id, false);
      notifications.show({ color: "red", message: error instanceof Error ? error.message : "Could not create the short link." });
    }
  }

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notifications.show({ color: "teal", message: "Public URL copied." });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notifications.show({ color: "red", message: "We could not copy the URL. Select it and copy it manually." });
    }
  }

  async function share(): Promise<void> {
    if (!enabled) return;
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title, text, url });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }

  /**
   * "Share to" menu (docs/26, Phase 2). The tagged short link counts the click
   * under the chosen channel. When the short link doesn't exist yet (or was
   * switched off) it is created/enabled first and the organizer picks the
   * channel again: opening a window after an await would be blocked as a popup.
   */
  async function shareTo(code: ShareChannelCode): Promise<void> {
    if (!shortLink) return;
    const channel = SHARE_CHANNELS.find((c) => c.code === code);
    if (!channel) return;
    if (!short.link?.enabled) {
      try {
        if (short.link?.disabled_by_admin) throw new Error("This short link has been disabled by the platform.");
        if (!short.link) await short.create.mutateAsync();
        else await short.update.mutateAsync({ enabled: true });
        notifications.show({ color: "teal", message: "Short link ready. Choose a channel again to share it." });
      } catch (error) {
        notifications.show({ color: "red", message: error instanceof Error ? error.message : "Could not create the short link." });
      }
      return;
    }
    const tagged = taggedShortUrl(short.link.short_url, code);
    const href = shareIntentUrl(code, tagged, title, text);
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      await navigator.clipboard.writeText(tagged);
      notifications.show({ color: "teal", message: `Link for ${channel.label} copied. Paste it into your bio or story.` });
    } catch {
      notifications.show({ color: "red", message: "We could not copy the URL. Select it and copy it manually." });
    }
  }

  const actions = (
    <Group gap="xs" wrap="wrap">
      <Button disabled={!enabled} variant={variant === "compact" ? "subtle" : "light"} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy} mih={44}>
        {copied ? "Copied" : "Copy link"}
      </Button>
      {enabled ? (
        <Button component="a" href={longUrl} target="_blank" rel="noopener noreferrer" variant={variant === "compact" ? "subtle" : "light"} leftSection={<IconExternalLink size={16} />} mih={44}>View page</Button>
      ) : (
        <Button disabled variant="subtle" leftSection={<IconExternalLink size={16} />} mih={44}>View page</Button>
      )}
      <Button disabled={!enabled} variant={variant === "compact" ? "subtle" : "light"} leftSection={<IconShare size={16} />} onClick={share} mih={44}>Share</Button>
      {shortable && (
        <Menu withinPortal position="bottom-end" shadow="md">
          <Menu.Target>
            <Button variant={variant === "compact" ? "subtle" : "light"} rightSection={<IconChevronDown size={14} />} mih={44}>Share to</Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Counted per channel</Menu.Label>
            {SHARE_CHANNELS.map((channel) => (
              <Menu.Item key={channel.code} onClick={() => void shareTo(channel.code)}>
                {channel.kind === "intent" ? channel.label : `${channel.label} (copy link)`}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
    </Group>
  );

  if (variant === "compact") {
    return (
      <Paper withBorder radius="md" px={{ base: "sm", sm: "md" }} py="xs">
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <ThemeIcon variant="light" size={38} radius="md" color={enabled ? "brand" : "gray"} style={{ flexShrink: 0 }}><IconLink size={19} /></ThemeIcon>
            <Stack gap={1} miw={0}>
              <Group gap={6}><Text size="sm" fw={600}>{heading}</Text><Badge size="xs" variant="light" color={enabled ? "teal" : "gray"}>{enabled ? "Public" : "Not public"}</Badge></Group>
              <Text size="xs" c="dimmed" truncate title={enabled ? url : disabledExplanation}>{enabled ? url : disabledExplanation}</Text>
              {shortable && (
                <Group gap="xs" mt={2}>
                  <Switch size="xs" label="Shorten link" checked={shortActive || (preferShort && (short.create.isPending || short.update.isPending))} disabled={short.query.isLoading || short.create.isPending || short.update.isPending} onChange={(event) => void toggleShort(event.currentTarget.checked)} />
                  {shortActive && short.link && <Text size="xs" c="dimmed">{short.link.click_count.toLocaleString()} click{short.link.click_count === 1 ? "" : "s"}</Text>}
                </Group>
              )}
            </Stack>
          </Group>
          {actions}
        </Group>
      </Paper>
    );
  }

  return (
    <Card withBorder radius="lg" p={{ base: "md", sm: "xl" }} pos="relative" style={{ overflow: "hidden" }}>
      <Box h={4} pos="absolute" top={0} left={0} right={0} bg="brand" />
      <Stack gap="lg">
        <Group align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" size={44} radius="md" color="brand" style={{ flexShrink: 0 }}><IconLink size={22} /></ThemeIcon>
          <Stack gap={3}>
            <Group gap="xs"><Text fw={700}>{heading}</Text><Badge size="sm" variant="light" color="teal">Public</Badge></Group>
            <Text size="sm" c="dimmed">Share one link where visitors can discover every public event from your organization.</Text>
          </Stack>
        </Group>
        <Paper withBorder radius="md" px="md" py="sm" bg="var(--mantine-color-default-hover)" onClick={(event) => window.getSelection()?.selectAllChildren(event.currentTarget)} style={{ cursor: "text" }}>
          <Text ff="monospace" size="sm" tabIndex={0} aria-label="Canonical public URL" style={{ overflowWrap: "anywhere", userSelect: "all" }}>{url}</Text>
        </Paper>
        {actions}
      </Stack>
    </Card>
  );
}
