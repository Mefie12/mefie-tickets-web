"use client";

import { useState } from "react";
import { Alert, Button, Checkbox, Group, Modal, Stack, Text } from "@mantine/core";
import { rescheduleSections, type RescheduleImpact } from "@/lib/rescheduleImpact";

export type ScheduleLabel = { start: string; end: string };

/**
 * The confirmation shown before the dates of an event that people have already paid for are changed. It lists
 * only what applies (attendees, scanners, payouts, sales windows) with real numbers from the API, and the
 * organizer must tick that they understand before Save is enabled. Attendee emailing is their choice, on by default.
 */
export function RescheduleConfirmDialog({
  opened,
  impact,
  before,
  after,
  change,
  submitting,
  onCancel,
  onConfirm,
}: {
  opened: boolean;
  impact: RescheduleImpact | null;
  before: ScheduleLabel;
  after: ScheduleLabel;
  change: { startChanged: boolean; endChanged: boolean };
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (options: { notifyAttendees: boolean }) => void;
}) {
  const [understood, setUnderstood] = useState(false);
  const [notify, setNotify] = useState(true);
  const sections = impact ? rescheduleSections(impact, change) : [];

  function handleClose() {
    if (submitting) return;
    setUnderstood(false);
    setNotify(true);
    onCancel();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Change the date of an event with orders?" size="lg" centered closeOnClickOutside={false}>
      <Stack>
        <Alert color="gray" variant="light">
          <Text size="sm">
            <strong>Was:</strong> {before.start} to {before.end}
          </Text>
          <Text size="sm">
            <strong>Now:</strong> {after.start} to {after.end}
          </Text>
        </Alert>

        {sections.map((section) => (
          <Alert key={section.key} color={section.tone} variant="light" title={section.title}>
            {section.body}
          </Alert>
        ))}

        {impact && impact.recipients > 0 && (
          <Checkbox
            checked={notify}
            onChange={(e) => setNotify(e.currentTarget.checked)}
            label={`Email the ${impact.recipients} ${impact.recipients === 1 ? "person" : "people"} holding tickets the new date`}
            description="Recommended. Untick it for a small correction you don't want to announce."
          />
        )}

        <Checkbox
          checked={understood}
          onChange={(e) => setUnderstood(e.currentTarget.checked)}
          label="I understand this affects my attendees, scanners and payouts"
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose} disabled={submitting}>
            Keep current dates
          </Button>
          <Button color="red" disabled={!understood} loading={submitting} onClick={() => onConfirm({ notifyAttendees: notify })}>
            Change the date
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
