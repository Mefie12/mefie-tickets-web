"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Group, Modal, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconMail, IconPencil } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import type { AttendeeDetail } from "@/lib/attendeeApi";

export function AttendeeDeliveryPanel({ eventId, attendee }: { eventId: string; attendee: AttendeeDetail }) {
  const router = useRouter();
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [email, setEmail] = useState(attendee.email);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const unknownOutcome = attendee.ticket.deliveries.some((delivery) => delivery.review_required);
  const sentToCurrentAddress = attendee.ticket.deliveries.some((delivery) =>
    delivery.recipient_email.toLowerCase() === attendee.email.toLowerCase()
      && ["SENDING", "SENT"].includes(delivery.workflow_status),
  );

  async function submitCorrection() {
    setBusy(true);
    const response = await fetch(`/api/events/${eventId}/attendees/${attendee.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, reason }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return notifications.show({ color: "red", message: payload?.message ?? "Unable to correct contact." });
    notifications.show({ color: "teal", message: "Contact corrected. The ticket was not sent automatically." });
    setCorrectionOpen(false); setReason(""); router.refresh();
  }

  async function submitResend() {
    setBusy(true);
    const response = await fetch(`/api/events/${eventId}/tickets/${attendee.ticket.id}/resend`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true, reason }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return notifications.show({ color: "red", message: payload?.message ?? "Unable to resend ticket." });
    notifications.show({ color: "teal", message: "A new ticket delivery generation was queued." });
    setResendOpen(false); setReason(""); router.refresh();
  }

  return <>
    <Card withBorder radius="lg">
      <Group justify="space-between" align="flex-start"><div><Title order={4}>Ticket delivery</Title><Text size="sm" c="dimmed">Recipient history and delivery outcomes</Text></div><Group><Button variant="default" leftSection={<IconPencil size={16}/>} onClick={()=>setCorrectionOpen(true)} disabled={attendee.ticket.is_checked_in}>Correct contact</Button><Button leftSection={<IconMail size={16}/>} onClick={()=>setResendOpen(true)}>Resend ticket</Button></Group></Group>
      {!sentToCurrentAddress && <Alert mt="md" color="yellow" icon={<IconAlertTriangle size={18}/>}>This ticket has not yet been sent to the current attendee address.</Alert>}
      {unknownOutcome && <Alert mt="md" color="orange" title="Delivery outcome needs review" icon={<IconAlertTriangle size={18}/>}>The provider may have accepted an earlier email, but Mefie could not confirm it. A manual resend may create a duplicate email.</Alert>}
      <Stack mt="md" gap="sm">{attendee.ticket.deliveries.length ? attendee.ticket.deliveries.map((delivery)=><Card key={delivery.id} withBorder padding="sm"><Group justify="space-between"><Text fw={600}>Generation {delivery.generation}</Text><Group gap="xs"><Badge variant="light">{delivery.workflow_status}</Badge><Badge variant="light" color={delivery.provider_status==="DELIVERED"?"teal":"gray"}>{delivery.provider_status}</Badge></Group></Group><Text size="sm">{delivery.recipient_email}</Text><Text size="xs" c="dimmed">{delivery.routing_reason.replaceAll("_"," ")} · {delivery.attachment_mode??"Not prepared"}</Text>{delivery.current_address_mismatch&&<Text size="xs" c="orange">Historical recipient differs from the current attendee address.</Text>}{delivery.failure_code&&<Text size="xs" c="red">{delivery.failure_code.replaceAll("_"," ")}</Text>}</Card>):<Text c="dimmed">No delivery attempts yet.</Text>}</Stack>
    </Card>
    <Modal opened={correctionOpen} onClose={()=>setCorrectionOpen(false)} title="Correct attendee contact"><Stack><Text size="sm">Use this only for a typo or contact correction. It does not reassign the ticket and will not send automatically.</Text><TextInput label="Correct email" value={email} onChange={(event)=>setEmail(event.currentTarget.value)} required/><Textarea label="Audit reason" value={reason} onChange={(event)=>setReason(event.currentTarget.value)} required maxLength={500}/><Button loading={busy} disabled={email.trim().toLowerCase()===attendee.email.toLowerCase()||reason.trim().length<3} onClick={submitCorrection}>Save correction</Button></Stack></Modal>
    <Modal opened={resendOpen} onClose={()=>setResendOpen(false)} title="Resend this ticket"><Stack>{unknownOutcome&&<Alert color="orange">The previous outcome is unknown. Continue only after reviewing the recipient; this may send a duplicate.</Alert>}<Text size="sm">A new delivery generation will be sent to the currently valid route. The ticket reference and QR credential will not change.</Text><Textarea label="Audit reason" value={reason} onChange={(event)=>setReason(event.currentTarget.value)} required maxLength={500}/><Button color={unknownOutcome?"orange":undefined} loading={busy} disabled={reason.trim().length<3} onClick={submitResend}>Confirm resend</Button></Stack></Modal>
  </>;
}
