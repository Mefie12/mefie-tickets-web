"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Group, Modal, Stack, Text, TextInput, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";

export function PublicSearchPanel({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const mobile = useMediaQuery("(max-width: 48em)");
  const router = useRouter();
  function close() { setQuery(""); onClose(); }
  function submit() { const value = query.trim(); router.push(value ? `/discover?q=${encodeURIComponent(value)}` : "/discover"); close(); }
  return <Modal opened={opened} onClose={close} fullScreen={mobile} size="lg" centered title="Search Mefie Tickets" aria-label="Search events"><Stack gap="lg" py="md"><Stack gap={4}><Title order={2}>Find your next experience</Title><Text c="dimmed">Search events, organizers, venues, or cities.</Text></Stack><form onSubmit={(event) => { event.preventDefault(); submit(); }}><Group align="flex-end" wrap="nowrap"><TextInput autoFocus aria-label="Search events, organizers, venues, or cities" placeholder="Search events, organizers, venues, or cities" leftSection={<IconSearch size={18} />} value={query} onChange={(event) => setQuery(event.currentTarget.value)} style={{ flex: 1 }} size="lg" /><Button type="submit" size="lg">Search</Button></Group></form></Stack></Modal>;
}
