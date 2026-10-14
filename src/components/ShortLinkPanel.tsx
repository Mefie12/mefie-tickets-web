"use client";

import { useState } from "react";
import { Alert, Button, Group, Loader, Paper, Stack, Switch, Text, TextInput } from "@mantine/core";
import { IconCopy, IconLink } from "@tabler/icons-react";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import type { EventVisibility } from "@/lib/eventApi";
import { validateAlias, normalizeAlias, type ShortLinkTarget } from "@/lib/shortLink";
import { useShortLink } from "@/lib/useShortLink";

/**
 * Organizer controls for the short link (docs/26), shown in the sharing
 * dialog. The permanent code never changes; the optional custom link can be
 * edited, and a replaced custom link stops working for good.
 */
export function ShortLinkPanel({ target, id, visibility, archived, active }: { target: ShortLinkTarget; id: number; visibility: EventVisibility; archived: boolean; active: boolean }) {
  const unsupported = archived || visibility === "INVITED";
  const { link, query, create, update } = useShortLink(target, id, active && !unsupported);
  const [draft, setDraft] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  if (unsupported) {
    return <Text size="sm" c="dimmed">{archived ? "Archived events can't have short links." : "Invite-only events can't have short links — invitees need their own invitation link."}</Text>;
  }

  const fail = (error: Error) => notifications.show({ color: "red", message: error.message });
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notifications.show({ color: "teal", message: "Short link copied." });
    } catch {
      notifications.show({ color: "red", message: "Could not copy the link. Select it and copy it manually." });
    }
  };

  if (query.isLoading) return <Loader size="sm" />;
  if (query.isError) return <Alert color="red">{query.error.message}</Alert>;

  if (!link) {
    return (
      <Group justify="space-between" align="center" wrap="nowrap">
        <Text size="sm" c="dimmed">Create a short link that&apos;s easy to share on social media and in messages.</Text>
        <Button size="xs" leftSection={<IconLink size={14} />} loading={create.isPending} onClick={() => create.mutate(undefined, { onError: fail })}>Create short link</Button>
      </Group>
    );
  }

  const prefix = link.short_url.slice(0, link.short_url.lastIndexOf("/") + 1);
  const value = draft ?? link.alias ?? "";
  const clientError = validateAlias(value);
  const dirty = normalizeAlias(value) !== (link.alias ?? "");

  function save() {
    const alias = normalizeAlias(value);
    const apply = () => update.mutate({ alias: alias === "" ? null : alias }, {
      onSuccess: () => { setDraft(null); setServerError(null); notifications.show({ color: "teal", message: alias === "" ? "Custom link removed." : "Custom link saved." }); },
      onError: (error) => setServerError(error.message),
    });
    if (!link?.alias && link?.click_count === 0) return apply();
    modals.openConfirmModal({
      title: link?.alias ? "Change your custom link?" : "Add a custom link?",
      centered: true,
      children: (
        <Text size="sm">
          {link?.alias ? <>The old custom link <b>{prefix}{link.alias}</b> will stop working and can never be reused. </> : null}
          This short link has been opened {link?.click_count ?? 0} time{link?.click_count === 1 ? "" : "s"}. Set your custom link before you share it widely. The permanent link <b>{prefix}{link?.code}</b> always keeps working.
        </Text>
      ),
      labels: { confirm: "Save", cancel: "Cancel" },
      onConfirm: apply,
    });
  }

  function toggleActive(next: boolean) {
    const apply = () => update.mutate({ enabled: next }, { onError: fail });
    if (next) return apply();
    modals.openConfirmModal({
      title: "Switch off the short link?",
      centered: true,
      children: <Text size="sm">Everyone who opens the short link — including the permanent code and any custom link — will be sent to the Discover page until you switch it back on. Your event page itself is unaffected.</Text>,
      labels: { confirm: "Switch off", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: apply,
    });
  }

  return (
    <Stack gap="sm">
      {link.disabled_by_admin && <Alert color="red" title="Disabled by Mefie">This short link has been disabled by the platform. Contact support if you think this is a mistake.</Alert>}
      <Paper withBorder radius="md" px="md" py="sm" bg="var(--mantine-color-default-hover)">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Text ff="monospace" size="sm" miw={0} style={{ flex: "1 1 14rem", overflowWrap: "anywhere" }} aria-label="Short link">{link.short_url}</Text>
          <Button size="compact-sm" variant="light" leftSection={<IconCopy size={14} />} disabled={!link.enabled} onClick={() => void copy(link.short_url)} style={{ flexShrink: 0 }}>Copy</Button>
        </Group>
      </Paper>
      <Group justify="space-between" align="center">
        <Switch label="Short link active" checked={link.enabled} disabled={link.disabled_by_admin || update.isPending} onChange={(event) => toggleActive(event.currentTarget.checked)} />
        <Text size="xs" c="dimmed">{link.click_count.toLocaleString()} click{link.click_count === 1 ? "" : "s"} · excludes link-preview bots</Text>
      </Group>
      <TextInput
        label="Custom link (optional)"
        description={link.alias_locked ? "Custom links have been disabled for this event by the platform. The short link above still works." : "Easier to remember, e.g. summer-fest. Set it before you share the link."}
        leftSection={<Text size="xs" c="dimmed" pl={8}>/s/</Text>}
        leftSectionWidth={36}
        placeholder={link.code}
        value={value}
        onChange={(event) => { setDraft(event.currentTarget.value); setServerError(null); }}
        error={clientError ?? serverError}
        disabled={link.disabled_by_admin || link.alias_locked}
        maxLength={40}
      />
      <Group justify="flex-end">
        <Button size="sm" variant="default" disabled={!dirty || clientError !== null || link.disabled_by_admin || link.alias_locked} loading={update.isPending} onClick={save}>Save custom link</Button>
      </Group>
    </Stack>
  );
}
