"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Loader, Modal, SegmentedControl, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  assignAttendee,
  assignSelf,
  getRegistrationSchema,
} from "@/lib/portalApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import {
  AttendeeRegistrationFields,
  attendeeFormError,
  emptyAttendeeForm,
  toAttendeeRegistration,
  type AttendeeFormValue,
} from "@/components/AttendeeRegistrationFields";

/**
 * Assign one buyer-held entitlement — to the buyer (one click) or to a
 * named attendee (dynamic form from the entitlement's
 * registration-schema). docs/17 §8.3.
 */
export function AssignEntitlementModal({
  entitlementPublicId,
  opened,
  onClose,
  onDone,
}: {
  entitlementPublicId: string | null;
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [who, setWho] = useState<"me" | "other">("me");
  const [form, setForm] = useState<AttendeeFormValue>(emptyAttendeeForm);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const schema = useQuery({
    queryKey: ["reg-schema", entitlementPublicId],
    queryFn: () => getRegistrationSchema(entitlementPublicId!),
    enabled: opened && entitlementPublicId !== null,
  });

  const questions = schema.data?.attendee_questions ?? [];
  const personalAcceptance = schema.data?.requires_personal_acceptance ?? false;

  const submit = useMutation({
    mutationFn: () => {
      if (who === "me") return assignSelf(entitlementPublicId!, requestKey);
      const problem = attendeeFormError(form, questions);
      if (problem) return Promise.reject(new Error(problem));
      return assignAttendee(entitlementPublicId!, toAttendeeRegistration(form, questions), requestKey);
    },
    onSuccess: () => {
      notifications.show({ color: "teal", message: "Ticket assigned." });
      reset();
      onDone();
    },
    onError: (err) => setError(resolveApiErrorMessage(err)),
  });

  function reset() {
    setWho("me");
    setForm(emptyAttendeeForm);
    setError(null);
  }

  function close() {
    if (submit.isPending) return;
    reset();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={close} title="Assign this ticket" centered>
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}

        <SegmentedControl
          fullWidth
          value={who}
          onChange={(v) => setWho(v as "me" | "other")}
          data={[
            { label: "It's for me", value: "me" },
            { label: "Someone else", value: "other" },
          ]}
        />

        {who === "other" && schema.isLoading && <Loader size="sm" />}

        {who === "other" && schema.data && (
          <>
            {personalAcceptance && (
              <Text size="sm" c="dimmed">
                They&apos;ll get an email to personally confirm their spot before the ticket becomes valid.
              </Text>
            )}
            <AttendeeRegistrationFields value={form} onChange={setForm} questions={questions} />
          </>
        )}

        <Button onClick={() => submit.mutate()} loading={submit.isPending} disabled={who === "other" && schema.isLoading}>
          {who === "me" ? "Assign to me" : "Assign ticket"}
        </Button>
      </Stack>
    </Modal>
  );
}
