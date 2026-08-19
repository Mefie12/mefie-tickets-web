import { notFound } from "next/navigation";
import { Stack, Title } from "@mantine/core";
import { backendRequest } from "@/lib/backend";
import type { AttendeeListResponse } from "@/lib/attendeeApi";
import { AttendeesTable } from "@/components/AttendeesTable";
export default async function AttendeesPage({params}:{params:Promise<{eventId:string}>}){const{eventId}=await params;const result=await backendRequest<AttendeeListResponse>(`/api/events/${eventId}/attendees`);if(result.status===404)notFound();if(result.status!==200)throw new Error("Unable to load attendees.");return <Stack gap="lg"><Title order={3}>Attendees</Title><AttendeesTable eventId={Number(eventId)} initial={result.data}/></Stack>}
