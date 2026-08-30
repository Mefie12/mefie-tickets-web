"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Loader, Modal, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import {
  getRegistrationSchema,
  reassignEntitlement,
  revokeEntitlement,
  type EntitlementRow,
} from "@/lib/portalApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { ConsumerStepUp } from "@/components/ConsumerStepUp";
import {
  AttendeeRegistrationFields,
  attendeeFormError,
  emptyAttendeeForm,
  toAttendeeRegistration,
  type AttendeeFormValue,
} from "@/components/AttendeeRegistrationFields";
import { ticketLabel } from "@/lib/portalStatus";

/**
 * Revoke (return an issued unit to buyer-held) or reassign it to a new
 * attendee (new credential generation). Both need a fresh step-up
 * (docs/17 §11) — on STEP_UP_REQUIRED this swaps to ConsumerStepUp and
 * retries once verified.
 */
export function RevokeReassignModal({
  mode,
  entitlement,
  opened,
  onClose,
  onDone,
}: {
  mode: "revoke" | "reassign";
  entitlement: EntitlementRow | null;
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [form, setForm] = useState<AttendeeFormValue>(emptyAttendeeForm);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [needStepUp, setNeedStepUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schema = useQuery({
    queryKey: ["reg-schema", entitlement?.public_id],
    queryFn: () => getRegistrationSchema(entitlement!.public_id),
    enabled: opened && mode === "reassign" && entitlement !== null,
  });
  const questions = schema.data?.attendee_questions ?? [];

  function reset() {
    setReason("");
    setForm(emptyAttendeeForm);
    setNeedStepUp(false);
    setError(null);
  }

  const run = useMutation({
    mutationFn: () => {
      if (mode === "revoke") return revokeEntitlement(entitlement!.public_id, { reason: reason.trim() || undefined });
      const problem = attendeeFormError(form, questions);
      if (problem) return Promise.reject(new Error(problem));
      return reassignEntitlement(entitlement!.public_id, toAttendeeRegistration(form, questions), requestKey);
    },
    onSuccess: () => {
      notifications.show({
        color: mode === "revoke" ? "gray" : "teal",
        message: mode === "revoke" ? "Ticket returned to unassigned." : "Ticket reassigned — a new pass was issued.",
      });
      reset();
      onDone();
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "STEP_UP_REQUIRED") {
        setNeedStepUp(true);
        setError(null);
        return;
      }
      setError(resolveApiErrorMessage(err));
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (run.isPending) return;
        reset();
        onClose();
      }}
      title={mode === "revoke" ? "Unassign this ticket" : "Reassign this ticket"}
      centered
    >
      <Stack gap="md">
        {entitlement && (
          <Text size="sm" c="dimmed">
            {ticketLabel(entitlement.ticket)} #{entitlement.sequence_number}
            {entitlement.attendee ? ` · ${entitlement.attendee.first_name} ${entitlement.attendee.last_name}` : ""}
          </Text>
        )}

        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {needStepUp ? (
          <ConsumerStepUp onVerified={() => { setNeedStepUp(false); run.mutate(); }} />
        ) : mode === "revoke" ? (
          <>
            <Text size="sm">
              The current pass stops working immediately and the ticket goes back to your unassigned pool.
            </Text>
            <Textarea
              label="Reason (optional)"
              autosize
              minRows={2}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            />
            <Button color="red" onClick={() => run.mutate()} loading={run.isPending}>
              Unassign ticket
            </Button>
          </>
        ) : (
          <>
            {schema.isLoading && <Loader size="sm" />}
            {schema.data && (
              <>
                <Text size="sm">
                  The old pass stops working; the new attendee gets a fresh one.
                </Text>
                <AttendeeRegistrationFields value={form} onChange={setForm} questions={questions} />
                <Button onClick={() => run.mutate()} loading={run.isPending}>
                  Reassign ticket
                </Button>
              </>
            )}
          </>
        )}
      </Stack>
    </Modal>
  );
}
