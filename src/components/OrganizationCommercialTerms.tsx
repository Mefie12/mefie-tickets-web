"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Group, List, Loader, Modal, Stack, Table, Text, Textarea, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { redirectOnAdminAuthError } from "@/lib/adminAuthErrorRedirect";
import { clearAdminDraft, isAdminStepUpError, peekAdminDraft, saveAdminDraft } from "@/lib/adminDraft";
import { AdminReasonModal } from "@/components/AdminReasonModal";
import { formatBasisPointsAsPercent } from "@/lib/money";
import {
  createFeeAgreement,
  endOfDayIso,
  feeAgreementState,
  FeeAgreementImpactError,
  listFeeAgreements,
  percentToBasisPoints,
  revokeFeeAgreement,
  type FeeAgreement,
  type FeeAgreementImpact,
  type FeeAgreementState,
} from "@/lib/feeAgreementApi";

const STATE_LABEL: Record<FeeAgreementState, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "teal" },
  SCHEDULED_END: { label: "Active · ends on schedule", color: "teal" },
  EXPIRED: { label: "Expired", color: "gray" },
  SUPERSEDED: { label: "Replaced", color: "gray" },
  REVOKED: { label: "Ended early", color: "orange" },
};

/** What the admin had typed when a step-up re-authentication interrupted them. */
type Draft =
  | { kind: "set"; percent: string; reference: string; endDate: string }
  | { kind: "end"; reason: string };

const draftKey = (organizationId: string) => `fee-agreement-draft:${organizationId}`;

const when = (value: string | null) => (value ? new Date(value).toLocaleString() : "—");
const person = (user: { first_name: string; last_name: string } | null) => (user ? `${user.first_name} ${user.last_name}` : "—");

/**
 * Platform Admin: the organization's negotiated platform fee (docs/24).
 * The rate is frozen onto each event at its first paid sale, so this only
 * ever affects events that have not sold yet — the panel says so, rather
 * than letting an admin assume a deal retroactively reprices live sales.
 */
export function OrganizationCommercialTerms({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // Back from a step-up: reopen the dialog with what the admin had typed. The
  // interrupted request is never replayed — they review and press the button.
  // Read at first render (client only) so the dialogs mount already filled in.
  const [restored] = useState<Draft | null>(() =>
    typeof window === "undefined" ? null : peekAdminDraft<Draft>(draftKey(organizationId)),
  );
  const [setOpen, setSetOpen] = useState(restored?.kind === "set");
  const [endOpen, setEndOpen] = useState(restored?.kind === "end");
  const [pendingEnd, setPendingEnd] = useState<{ reason: string; impact: FeeAgreementImpact } | null>(null);

  // Consumed once it has been used; a refresh after this starts clean.
  useEffect(() => {
    clearAdminDraft(draftKey(organizationId));
  }, [organizationId]);

  const queryKey = ["admin-organization-fee-agreements", organizationId];
  const query = useQuery({ queryKey, queryFn: () => listFeeAgreements(organizationId), retry: false });

  function handleError(error: Error, draft?: Draft) {
    if (draft && isAdminStepUpError(error)) saveAdminDraft(draftKey(organizationId), draft);
    if (redirectOnAdminAuthError(error, router)) return;
    notifications.show({ color: "red", message: error.message });
  }

  const endMutation = useMutation({
    mutationFn: (input: { agreement: FeeAgreement; reason: string; acknowledge: boolean }) =>
      revokeFeeAgreement(organizationId, input.agreement.id, input.reason, input.acknowledge),
    onSuccess: () => {
      setEndOpen(false);
      setPendingEnd(null);
      queryClient.invalidateQueries({ queryKey });
      notifications.show({ color: "teal", message: "Agreement ended. The standard rate applies to events that have not sold yet." });
    },
    onError: (error: Error, variables) => {
      if (error instanceof FeeAgreementImpactError) {
        setEndOpen(false);
        setPendingEnd({ reason: variables.reason, impact: error.impact });
        return;
      }
      handleError(error, { kind: "end", reason: variables.reason });
    },
  });

  if (query.isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }
  if (!query.data) {
    return <Alert color="red">{(query.error as Error | null)?.message ?? "Could not load commercial terms."}</Alert>;
  }

  const { fee_agreements: agreements, standard_platform_fee_basis_points: standardBp, max_platform_fee_basis_points: maxBp } = query.data;
  const current = agreements.find((a) => a.ended_at === null && feeAgreementState(a) !== "EXPIRED") ?? null;
  const effectiveBp = current ? current.platform_fee_basis_points : standardBp;

  return (
    <Stack gap="lg">
      <Alert icon={<IconInfoCircle size={18} />} color="blue" variant="light" title="How a negotiated rate applies">
        <Text size="sm">
          Set the rate <b>before</b> the organization publishes its events. Each event locks in the rate in force when it makes its
          first paid sale, and keeps it from then on — a change here never reprices an event that has already sold, and an agreement
          that expires later does not change events that locked in under it.
        </Text>
        {query.data.events_with_frozen_rate > 0 && (
          <Text size="sm" mt="xs">
            {query.data.events_with_frozen_rate} event{query.data.events_with_frozen_rate === 1 ? "" : "s"} of this organization already
            {query.data.events_with_frozen_rate === 1 ? " has" : " have"} a locked-in rate and will not follow a new agreement.
          </Text>
        )}
      </Alert>

      <Card withBorder radius="lg" p="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={3}>{formatBasisPointsAsPercent(effectiveBp)}</Title>
              <Badge color={current ? "violet" : "gray"} variant="light">
                {current ? "Negotiated rate" : "Standard rate"}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Platform fee on tickets{current ? ` · standard rate is ${formatBasisPointsAsPercent(standardBp)}` : ""}
            </Text>
            {current && (
              <Text size="sm" mt="xs">
                Since {when(current.starts_at)}
                {current.ends_at ? ` · ends ${when(current.ends_at)}` : " · no end date"}
                <br />
                <Text span c="dimmed">
                  {current.reference}
                </Text>
              </Text>
            )}
          </Stack>
          {canManage && (
            <Group>
              {current && (
                <Button variant="outline" color="orange" onClick={() => setEndOpen(true)}>
                  End agreement
                </Button>
              )}
              <Button onClick={() => setSetOpen(true)}>{current ? "Change rate" : "Set negotiated rate"}</Button>
            </Group>
          )}
        </Group>
      </Card>

      <Stack gap="xs">
        <Title order={4}>History</Title>
        {agreements.length === 0 ? (
          <Text c="dimmed" ta="center" py="lg">
            No negotiated rates have been set for this organization.
          </Text>
        ) : (
          <Table.ScrollContainer minWidth={760}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Rate</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>From</Table.Th>
                <Table.Th>Until</Table.Th>
                <Table.Th>Reference</Table.Th>
                <Table.Th>Set by</Table.Th>
                <Table.Th>Ended by</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {agreements.map((agreement) => {
                const state = STATE_LABEL[feeAgreementState(agreement)];
                return (
                  <Table.Tr key={agreement.id}>
                    <Table.Td fw={600}>{formatBasisPointsAsPercent(agreement.platform_fee_basis_points)}</Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <Badge color={state.color} variant="light" styles={{ root: { overflow: "visible" }, label: { overflow: "visible", textOverflow: "clip" } }}>
                        {state.label}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{when(agreement.starts_at)}</Table.Td>
                    <Table.Td>{when(agreement.ended_at ?? agreement.ends_at)}</Table.Td>
                    <Table.Td>{agreement.reference}</Table.Td>
                    <Table.Td>{person(agreement.creator)}</Table.Td>
                    <Table.Td>{person(agreement.ended_by_user)}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
          </Table.ScrollContainer>
        )}
      </Stack>

      <SetRateModal
        opened={setOpen}
        onClose={() => setSetOpen(false)}
        organizationId={organizationId}
        standardBp={standardBp}
        maxBp={maxBp}
        replacing={current}
        restoredDraft={restored?.kind === "set" ? restored : null}
        onSaved={() => {
          setSetOpen(false);
          queryClient.invalidateQueries({ queryKey });
          notifications.show({ color: "teal", message: "Negotiated rate saved." });
        }}
        onError={handleError}
      />

      <AdminReasonModal
        opened={endOpen}
        onClose={() => setEndOpen(false)}
        title="End this agreement?"
        description={`Events that have not made a sale yet will use the standard rate (${formatBasisPointsAsPercent(standardBp)}). Events that already locked in a rate are not affected.`}
        confirmLabel="End agreement"
        confirmColor="orange"
        loading={endMutation.isPending}
        initialReason={restored?.kind === "end" ? restored.reason : undefined}
        onConfirm={(reason) => current && endMutation.mutate({ agreement: current, reason, acknowledge: false })}
      />

      <Modal opened={pendingEnd !== null} onClose={() => setPendingEnd(null)} title="Prices would fall below the fee floor" centered>
        {pendingEnd && current && (
          <Stack>
            <ImpactList impact={pendingEnd.impact} />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setPendingEnd(null)}>
                Cancel
              </Button>
              <Button
                color="orange"
                loading={endMutation.isPending}
                onClick={() => endMutation.mutate({ agreement: current, reason: pendingEnd.reason, acknowledge: true })}
              >
                End agreement anyway
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}

function ImpactList({ impact }: { impact: FeeAgreementImpact }) {
  return (
    <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Live events that haven't sold yet would be affected">
      <Text size="sm" mb="xs">
        Under the new rate, these ticket prices would no longer cover the fees the event absorbs, so buyers could not complete a first
        purchase until the organizer raises them:
      </Text>
      <List size="sm" spacing={4}>
        {Object.entries(impact).map(([event, tickets]) => (
          <List.Item key={event}>
            <b>{event}</b> — {tickets.join(", ")}
          </List.Item>
        ))}
      </List>
    </Alert>
  );
}

function SetRateModal({
  opened,
  onClose,
  organizationId,
  standardBp,
  maxBp,
  replacing,
  restoredDraft,
  onSaved,
  onError,
}: {
  opened: boolean;
  onClose: () => void;
  organizationId: string;
  standardBp: number;
  maxBp: number;
  replacing: FeeAgreement | null;
  restoredDraft: Extract<Draft, { kind: "set" }> | null;
  onSaved: () => void;
  onError: (error: Error, draft?: Draft) => void;
}) {
  const [percent, setPercent] = useState(restoredDraft?.percent ?? "");
  const [reference, setReference] = useState(restoredDraft?.reference ?? "");
  const [endDate, setEndDate] = useState(restoredDraft?.endDate ?? "");
  const [showRestored, setShowRestored] = useState(restoredDraft !== null);
  const [impact, setImpact] = useState<FeeAgreementImpact | null>(null);

  const basisPoints = percentToBasisPoints(percent);
  const rateError =
    percent === ""
      ? null
      : basisPoints === null
        ? "Use a percentage with up to two decimals, e.g. 2.35."
        : basisPoints > maxBp
          ? `The highest rate allowed is ${formatBasisPointsAsPercent(maxBp)}.`
          : null;
  const endsAt = endDate ? endOfDayIso(endDate) : null;
  const endError = endDate && (endsAt === null || new Date(endsAt) <= new Date()) ? "Pick a date in the future." : null;
  const valid = basisPoints !== null && !rateError && reference.trim().length >= 3 && !endError;

  function reset() {
    setPercent("");
    setReference("");
    setEndDate("");
    setImpact(null);
    setShowRestored(false);
  }

  const mutation = useMutation({
    mutationFn: (acknowledge: boolean) =>
      createFeeAgreement(organizationId, {
        platform_fee_basis_points: basisPoints as number,
        reference: reference.trim(),
        ends_at: endsAt,
        acknowledge_impact: acknowledge,
      }),
    onSuccess: () => {
      reset();
      onSaved();
    },
    onError: (error: Error) => {
      if (error instanceof FeeAgreementImpactError) {
        setImpact(error.impact);
        return;
      }
      onError(error, { kind: "set", percent, reference, endDate });
    },
  });

  return (
    <Modal
      opened={opened}
      onClose={() => {
        reset();
        onClose();
      }}
      title={replacing ? "Change negotiated rate" : "Set negotiated rate"}
      centered
    >
      <Stack>
        {showRestored && (
          <Alert color="blue" variant="light" p="xs">
            <Text size="sm">Verified. Your entries were restored — review them and save again; nothing was saved yet.</Text>
          </Alert>
        )}
        {replacing && (
          <Text size="sm" c="dimmed">
            This replaces the current {formatBasisPointsAsPercent(replacing.platform_fee_basis_points)} agreement. It stays in the history.
          </Text>
        )}
        <TextInput
          label="Platform fee"
          description={`Standard rate is ${formatBasisPointsAsPercent(standardBp)}. Whole hundredths of a percent only.`}
          placeholder="2.35"
          rightSection={<Text size="sm">%</Text>}
          value={percent}
          onChange={(event) => {
            setPercent(event.currentTarget.value);
            setImpact(null);
          }}
          error={rateError}
          inputMode="decimal"
        />
        {basisPoints !== null && !rateError && basisPoints > standardBp && (
          <Alert color="yellow" variant="light" p="xs">
            <Text size="sm">This is higher than the standard rate.</Text>
          </Alert>
        )}
        <Textarea
          label="Reference"
          description="The contract or agreement this comes from. Recorded in the audit log."
          placeholder="e.g. Signed 2026-10-07, sales contact, contract link"
          minRows={2}
          autosize
          value={reference}
          onChange={(event) => setReference(event.currentTarget.value)}
        />
        <TextInput
          type="date"
          label="Ends on (optional)"
          description="Last day the rate can be locked into a new event, end of day in your browser's time zone. Leave empty for no end date."
          value={endDate}
          onChange={(event) => setEndDate(event.currentTarget.value)}
          error={endError}
        />
        {impact && <ImpactList impact={impact} />}
        <Group justify="flex-end">
          <Button
            variant="subtle"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button
            color={impact ? "orange" : undefined}
            loading={mutation.isPending}
            disabled={!valid}
            onClick={() => mutation.mutate(impact !== null)}
          >
            {impact ? "Save anyway" : "Save rate"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
