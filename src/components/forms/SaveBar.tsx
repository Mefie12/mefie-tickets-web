"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, Group, Popover, Text, Tooltip } from "@mantine/core";
import { IconAlertTriangle, IconCheck } from "@tabler/icons-react";
import { deriveSaveStatus, invalidMessage } from "@/lib/saveStatus";
import { reserveScrollPadding } from "@/lib/scrollPadding";
import classes from "./saveBar.module.css";

export const UNSAVED_ATTENTION_EVENT = "mefie:unsaved-attention";

/**
 * The one Save control for a form (use `useSaveBar` to feed it). Place it right after the form's
 * Card, not inside it: a Mantine Card clips overflow, which would stop the bar from pinning.
 *
 * Clean: a quiet Save button where the form ends, marked `aria-disabled` (still focusable, says why
 * on hover) rather than truly disabled. Dirty: the same row pins to the bottom of the screen with an
 * "Unsaved changes" status, Discard, and a filled Save. It stays pinned while saving and through the
 * "Saved" (or error) message, so the outcome shows where the organizer was looking, then settles back.
 * Status is text plus an icon, never colour alone.
 */
export function SaveBar({
  formId,
  onSave,
  dirty,
  saving,
  justSaved,
  errorMessage,
  invalidCount,
  onDiscard,
  saveLabel,
}: {
  formId: string;
  /** For a Save that is a click handler instead of a form submit. */
  onSave?: () => void;
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
  errorMessage: string | null;
  invalidCount: number;
  onDiscard: () => void;
  saveLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [attention, setAttention] = useState(false);
  const status = deriveSaveStatus({ dirty, saving, errorMessage, justSaved, invalidCount });
  const pinned = dirty || saving || justSaved || errorMessage !== null;

  // While pinned, keep keyboard focus from landing underneath the bar (WCAG 2.2 SC 2.4.11).
  useEffect(() => {
    if (!pinned || !ref.current) return;
    const height = ref.current.getBoundingClientRect().height || 64;
    return reserveScrollPadding(ref.current, Math.ceil(height) + 28);
  }, [pinned]);

  // Back after a long absence with edits pending: one gentle highlight (see useLeaveGuard).
  useEffect(() => {
    if (!dirty) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onAttention = () => {
      // Only the bar that is actually on screen reacts (several tabs stay mounted).
      if (!ref.current || ref.current.offsetParent === null) return;
      setAttention(true);
      clearTimeout(timer);
      timer = setTimeout(() => setAttention(false), 3000);
    };
    window.addEventListener(UNSAVED_ATTENTION_EVENT, onAttention);
    return () => {
      window.removeEventListener(UNSAVED_ATTENTION_EVENT, onAttention);
      clearTimeout(timer);
    };
  }, [dirty]);

  return (
    <Box ref={ref} id={`${formId}-bar`} className={classes.bar} data-pinned={pinned ? "true" : undefined} data-attention={attention ? "true" : undefined}>
      <Group justify="space-between" wrap="nowrap" gap="sm" className={classes.row}>
        {/* Announced politely; kept mounted so changes are read out. */}
        <Group gap={8} wrap="nowrap" className={classes.status} role="status" aria-live="polite">
          {status.kind === "dirty" && (
            <>
              <span className={classes.dot} style={{ background: "var(--mantine-color-yellow-6)" }} aria-hidden="true" />
              <Text size="sm" fw={600}>Unsaved changes</Text>
            </>
          )}
          {status.kind === "invalid" && (
            <>
              <IconAlertTriangle size={16} color="var(--mantine-color-yellow-text)" aria-hidden="true" />
              <Text size="sm" fw={600}>{invalidMessage(status.count)}</Text>
            </>
          )}
          {status.kind === "saving" && <Text size="sm" c="dimmed">Saving…</Text>}
          {status.kind === "error" && (
            <>
              <IconAlertTriangle size={16} color="var(--mantine-color-red-text)" aria-hidden="true" />
              <Text size="sm" fw={600} lineClamp={2} style={{ color: "var(--mantine-color-red-text)" }}>Couldn&apos;t save: {status.message}</Text>
            </>
          )}
          {status.kind === "saved" && (
            <>
              <IconCheck size={16} color="var(--mantine-color-teal-text)" aria-hidden="true" />
              <Text size="sm" c="dimmed">Saved</Text>
            </>
          )}
        </Group>

        <Group gap="xs" wrap="nowrap" className={classes.actions} justify="flex-end">
          {dirty && (
            <Popover opened={confirmingDiscard} onChange={setConfirmingDiscard} position="top-end" withArrow shadow="md" trapFocus returnFocus>
              <Popover.Target>
                <Button variant="subtle" color="gray" size="sm" disabled={saving} onClick={() => setConfirmingDiscard((open) => !open)}>
                  Discard
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Text size="sm" mb="xs">Discard all unsaved changes?</Text>
                <Group gap="xs" justify="flex-end">
                  <Button size="compact-sm" variant="default" onClick={() => setConfirmingDiscard(false)}>Keep editing</Button>
                  <Button size="compact-sm" color="red" onClick={() => { setConfirmingDiscard(false); onDiscard(); }}>Discard</Button>
                </Group>
              </Popover.Dropdown>
            </Popover>
          )}
          {/* aria-disabled, not disabled: still focusable, still explains itself. */}
          <Tooltip label="No changes to save" disabled={dirty || saving} withArrow>
            <Button
              type={onSave ? "button" : "submit"}
              form={onSave ? undefined : formId}
              size="sm"
              variant={dirty ? "filled" : "default"}
              loading={saving}
              aria-disabled={!dirty && !saving}
              onClick={(event) => {
                if (!dirty) event.preventDefault();
                else if (onSave) onSave();
              }}
              className={classes.saveButton}
              style={!dirty && !saving ? { color: "var(--mantine-color-dimmed)" } : undefined}
            >
              {saveLabel}
            </Button>
          </Tooltip>
        </Group>
      </Group>
    </Box>
  );
}
