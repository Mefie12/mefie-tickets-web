"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActionIcon, Alert, Badge, Button, Card, Group, Loader, Select, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArrowDown, IconArrowUp, IconStar, IconTrash } from "@tabler/icons-react";
import { addFeatured, listFeatured, removeFeatured, reorderFeatured, searchFeaturedCandidates } from "@/lib/featuredEventsAdminApi";

// Candidate ids aren't unique across events and series, so the Select's
// value/filter/submit all key on "type:id" rather than a bare id — see
// docs/13_recurring_events_prd.md §7.1 (a series can be featured too).
const candidateKey = (type: string, id: number) => `${type}:${id}`;

export default function FeaturedEventsPage() {
  const client = useQueryClient(); const [query, setQuery] = useState(""); const [selected, setSelected] = useState<string | null>(null);
  const placements = useQuery({ queryKey: ["featured-events"], queryFn: listFeatured });
  const candidates = useQuery({ queryKey: ["featured-candidates", query], queryFn: () => searchFeaturedCandidates(query) });
  const refresh = () => client.invalidateQueries({ queryKey: ["featured-events"] });
  const mutation = useMutation({ mutationFn: async (action: () => Promise<unknown>) => action(), onSuccess: () => { refresh(); setSelected(null); }, onError: (error: Error) => notifications.show({ color: "red", message: error.message }) });
  const rows = placements.data?.placements ?? [];
  function move(index: number, delta: number) { const reordered = [...rows]; const target = index + delta; if (target < 0 || target >= rows.length) return; [reordered[index], reordered[target]] = [reordered[target], reordered[index]]; mutation.mutate(() => reorderFeatured(reordered.map((item) => item.id))); }
  function addSelected() {
    if (!selected) return;
    const [type, id] = selected.split(":");
    mutation.mutate(() => addFeatured({ type: type as "event" | "series", id: Number(id) }));
  }
  return (
    <Stack gap="xl">
      <Stack gap={4}>
        <Title order={2}>Featured Events</Title>
        <Text c="dimmed">Curate up to eight homepage events or series in a fixed editorial order.</Text>
      </Stack>
      <Card withBorder>
        <Stack>
          <Select
            searchable
            clearable
            label="Add a live upcoming event or series"
            placeholder="Search by title or organizer"
            searchValue={query}
            onSearchChange={setQuery}
            value={selected}
            onChange={setSelected}
            data={(candidates.data?.candidates ?? [])
              .filter((candidate) => !rows.some((row) => row.type === candidate.type && row.target.id === candidate.id))
              .map((candidate) => ({
                value: candidateKey(candidate.type, candidate.id),
                label: `${candidate.title} — ${candidate.organization.name}${candidate.type === "series" ? " (series)" : ""}`,
              }))}
          />
          <Button leftSection={<IconStar size={16} />} disabled={!selected || rows.length >= 8} loading={mutation.isPending} onClick={addSelected}>
            Add featured item
          </Button>
        </Stack>
      </Card>
      {placements.isLoading ? (
        <Loader />
      ) : rows.length === 0 ? (
        <Alert>Nothing is currently featured.</Alert>
      ) : (
        <Stack>
          {rows.map((placement, index) => (
            <Card key={placement.id} withBorder>
              <Group justify="space-between" wrap="nowrap">
                <Group wrap="nowrap">
                  <Badge circle>{index + 1}</Badge>
                  <Stack gap={2}>
                    <Group gap={6}>
                      <Text fw={700}>{placement.target.title}</Text>
                      {placement.type === "series" && (
                        <Badge variant="light" size="sm">
                          Series
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {placement.target.organization.name}
                    </Text>
                    {!placement.eligible && <Badge color="orange">Hidden: {placement.ineligible_reason}</Badge>}
                  </Stack>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <ActionIcon aria-label="Move up" disabled={index === 0 || mutation.isPending} onClick={() => move(index, -1)}>
                    <IconArrowUp size={16} />
                  </ActionIcon>
                  <ActionIcon aria-label="Move down" disabled={index === rows.length - 1 || mutation.isPending} onClick={() => move(index, 1)}>
                    <IconArrowDown size={16} />
                  </ActionIcon>
                  <ActionIcon color="red" variant="light" aria-label="Remove" onClick={() => mutation.mutate(() => removeFeatured(placement.id))}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
