"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Divider, Loader, Modal, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { AnswerValue } from "@/lib/checkoutApi";
import { assignBulk, getRegistrationSchema, type EntitlementRow } from "@/lib/portalApi";
import { resolveApiErrorMessage } from "@/lib/apiErrorMessages";
import { EditableQuestionField, isQuestionAnswered } from "@/components/EditableQuestionField";
import type { PublicQuestion } from "@/lib/publicEventApi";
import { ticketLabel } from "@/lib/portalStatus";

type Row = { first_name: string; last_name: string; email: string };

function asPublicQuestion(q: { id: number; title: string; description: string | null; type: string; options: string[] | null; is_required: boolean }): PublicQuestion {
  return { id: q.id, title: q.title, description: q.description, scope: "ATTENDEE", type: q.type as PublicQuestion["type"], options: q.options, is_required: q.is_required, sort_order: 0 };
}

/**
 * Basic bulk assignment (docs/17 §2.1, G1): a name per selected ticket,
 * one shared set of event-question answers. The guided per-attendee
 * wizard is a separate G3 item.
 */
export function BulkAssignModal({
  entitlements,
  opened,
  onClose,
  onDone,
}: {
  entitlements: EntitlementRow[];
  opened: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [requestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);

  const firstId = entitlements[0]?.public_id ?? null;
  const schema = useQuery({
    queryKey: ["reg-schema", firstId],
    queryFn: () => getRegistrationSchema(firstId!),
    enabled: opened && firstId !== null,
  });
  const questions = schema.data?.attendee_questions ?? [];

  const rowFor = (id: string): Row => rows[id] ?? { first_name: "", last_name: "", email: "" };
  const patchRow = (id: string, p: Partial<Row>) => setRows((prev) => ({ ...prev, [id]: { ...rowFor(id), ...p } }));

  const submit = useMutation({
    mutationFn: () => {
      for (const e of entitlements) {
        const r = rowFor(e.public_id);
        if (!r.first_name.trim() || !r.last_name.trim()) {
          return Promise.reject(new Error("Enter a first and last name for every ticket."));
        }
        if (r.email.trim() && !/^\S+@\S+\.\S+$/.test(r.email)) {
          return Promise.reject(new Error("One of the email addresses isn't valid."));
        }
      }
      for (const q of questions) {
        if (!isQuestionAnswered(asPublicQuestion(q), answers[q.id])) {
          return Promise.reject(new Error(`'${q.title}' is required.`));
        }
      }
      return assignBulk({
        request_key: requestKey,
        shared_answers: questions.map((q) => ({ question_id: q.id, answer: answers[q.id] ?? "" })),
        items: entitlements.map((e) => {
          const r = rowFor(e.public_id);
          return {
            entitlement_public_id: e.public_id,
            first_name: r.first_name.trim(),
            last_name: r.last_name.trim(),
            email: r.email.trim() || null,
          };
        }),
      });
    },
    onSuccess: (data) => {
      const ok = data.results.filter((r) => r.status === "assigned").length;
      const bad = data.results.length - ok;
      notifications.show({
        color: bad === 0 ? "teal" : "yellow",
        message: bad === 0 ? `${ok} tickets assigned.` : `${ok} assigned, ${bad} could not be assigned.`,
      });
      setRows({});
      setAnswers({});
      onDone();
    },
    onError: (err) => setError(resolveApiErrorMessage(err)),
  });

  return (
    <Modal
      opened={opened}
      onClose={() => !submit.isPending && onClose()}
      title={`Assign ${entitlements.length} tickets`}
      centered
      size="lg"
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {schema.isLoading && <Loader size="sm" />}

        <Stack gap="sm">
          {entitlements.map((e) => {
            const r = rowFor(e.public_id);
            return (
              <Stack key={e.public_id} gap={4}>
                <Text size="xs" c="dimmed">
                  {ticketLabel(e.ticket)} #{e.sequence_number}
                </Text>
                <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="xs">
                  <TextInput placeholder="First name" size="sm" value={r.first_name} onChange={(ev) => patchRow(e.public_id, { first_name: ev.currentTarget.value })} />
                  <TextInput placeholder="Last name" size="sm" value={r.last_name} onChange={(ev) => patchRow(e.public_id, { last_name: ev.currentTarget.value })} />
                  <TextInput placeholder="Email (optional)" size="sm" type="email" value={r.email} onChange={(ev) => patchRow(e.public_id, { email: ev.currentTarget.value })} />
                </SimpleGrid>
              </Stack>
            );
          })}
        </Stack>

        {questions.length > 0 && (
          <>
            <Divider label="Shared answers — applied to every ticket" labelPosition="left" />
            {questions.map((q) => (
              <EditableQuestionField
                key={q.id}
                question={asPublicQuestion(q)}
                value={answers[q.id]}
                onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
              />
            ))}
          </>
        )}

        <Button onClick={() => submit.mutate()} loading={submit.isPending} disabled={schema.isLoading}>
          Assign {entitlements.length} tickets
        </Button>
      </Stack>
    </Modal>
  );
}
