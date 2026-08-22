"use client";

import { useState } from "react";
import { Badge, Box, Button, Card, Group, Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { IconCheck, IconCopy, IconExternalLink, IconLink, IconShare } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";

export type PublicShareCardProps = {
  url: string;
  title: string;
  text: string;
  enabled: boolean;
  disabledExplanation?: string;
  heading?: string;
  variant?: "feature" | "compact";
};

export function PublicShareCard({ url, title, text, enabled, disabledExplanation, heading = "Your organization URL", variant = "feature" }: PublicShareCardProps) {
  const [copied, setCopied] = useState(false);

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

  const actions = (
    <Group gap="xs" wrap="wrap">
      <Button disabled={!enabled} variant={variant === "compact" ? "subtle" : "light"} leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />} onClick={copy} mih={44}>
        {copied ? "Copied" : "Copy link"}
      </Button>
      {enabled ? (
        <Button component="a" href={url} target="_blank" rel="noopener noreferrer" variant={variant === "compact" ? "subtle" : "light"} leftSection={<IconExternalLink size={16} />} mih={44}>View page</Button>
      ) : (
        <Button disabled variant="subtle" leftSection={<IconExternalLink size={16} />} mih={44}>View page</Button>
      )}
      <Button disabled={!enabled} variant={variant === "compact" ? "subtle" : "light"} leftSection={<IconShare size={16} />} onClick={share} mih={44}>Share</Button>
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
