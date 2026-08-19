"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconArchive,
  IconCategory,
  IconChevronRight,
  IconDots,
  IconPlus,
  IconSearch,
  IconTags,
} from "@tabler/icons-react";
import {
  archiveTaxonomy,
  createAdminCategory,
  createAdminSubcategories,
  deleteTaxonomy,
  listAdminTaxonomy,
  mergeTaxonomy,
  restoreTaxonomy,
  taxonomyImpact,
  updateAdminTaxonomy,
  type AdminTaxonomyItem,
} from "@/lib/eventTaxonomyAdminApi";
import { fetchAdminSession } from "@/lib/adminAuthApi";
import classes from "./event-taxonomy.module.css";

type Selected = { type: "category" | "subcategory"; item: AdminTaxonomyItem };

const includes = (value: string, search: string) =>
  value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());

export default function EventTaxonomyPage() {
  const client = useQueryClient();
  const [archived, setArchived] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [search, setSearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [batch, setBatch] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [lifecycle, setLifecycle] = useState<Selected | null>(null);
  const [reason, setReason] = useState("");
  const [editName, setEditName] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-event-taxonomy", archived],
    queryFn: () => listAdminTaxonomy(archived),
  });
  const session = useQuery({ queryKey: ["admin-session"], queryFn: fetchAdminSession });
  const canManage = session.data?.permissions.includes("event_taxonomy.manage") ?? false;
  const categories = query.data?.categories ?? [];
  const visibleCategories = categories.filter((category) => includes(category.name, search));
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? visibleCategories[0];
  const visibleSubcategories = (selectedCategory?.subcategories ?? []).filter((item) =>
    includes(item.name, subcategorySearch),
  );

  const impact = useQuery({
    queryKey: ["taxonomy-impact", lifecycle?.type, lifecycle?.item.id],
    queryFn: () => taxonomyImpact(lifecycle!.type, lifecycle!.item.id),
    enabled: !!lifecycle,
  });

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["admin-event-taxonomy"] });
    setLifecycle(null);
    setReason("");
    setTargetId(null);
  };
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: refresh,
    onError: (error: Error) => notifications.show({ color: "red", message: error.message }),
  });

  const openActions = (type: Selected["type"], item: AdminTaxonomyItem) => {
    setEditName(item.name);
    setReason("");
    setTargetId(null);
    setLifecycle({ type, item });
  };

  const activeEventTotal = categories.reduce((sum, category) => sum + category.current_event_count, 0);
  const childTotal = categories.reduce((sum, category) => sum + category.subcategories.length, 0);

  return (
    <Stack gap="xl" maw={1180}>
      <Group justify="space-between" align="flex-start" gap="md">
        <Box>
          <Title order={2} fz={28}>Event taxonomy</Title>
          <Text c="dimmed" mt={4} maw={650}>
            Organize how events are classified across creation, discovery, and reporting.
          </Text>
        </Box>
        <SegmentedControl
          color="brand"
          aria-label="Taxonomy status"
          value={archived ? "archived" : "active"}
          onChange={(value) => {
            setArchived(value === "archived");
            setSelectedCategoryId(null);
            setSearch("");
            setSubcategorySearch("");
          }}
          data={[
            { label: "Active", value: "active" },
            { label: "Archived", value: "archived" },
          ]}
        />
      </Group>

      {query.isError && (
        <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Taxonomy could not be loaded">
          {query.error.message}
        </Alert>
      )}

      <Group gap="sm">
        <Badge variant="light" color="brand" size="lg">
          {categories.length} {archived ? "archived" : "active"} categories
        </Badge>
        <Badge variant="light" color="gray" size="lg">{childTotal} subcategories</Badge>
        <Badge variant="light" color="gray" size="lg">{activeEventTotal} current event references</Badge>
      </Group>

      <Grid gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Card withBorder p={0} h="100%" className={classes.panel}>
            <Stack gap="md" p="lg">
              <Group justify="space-between">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="brand"><IconCategory size={18} /></ThemeIcon>
                  <div>
                    <Text fw={700}>Categories</Text>
                    <Text size="xs" c="dimmed">Choose one to manage its children</Text>
                  </div>
                </Group>
                {!archived && canManage && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPlus size={15} />}
                    onClick={() => setShowCategoryForm((value) => !value)}
                  >
                    Add
                  </Button>
                )}
              </Group>

              {showCategoryForm && !archived && canManage && (
                <Paper withBorder p="sm" className={classes.formSurface}>
                  <Stack gap="xs">
                    <TextInput
                      label="Category name"
                      placeholder="e.g. Arts & culture"
                      value={categoryName}
                      onChange={(event) => setCategoryName(event.currentTarget.value)}
                      autoFocus
                    />
                    <Group justify="flex-end" gap="xs">
                      <Button variant="subtle" color="gray" size="xs" onClick={() => setShowCategoryForm(false)}>Cancel</Button>
                      <Button
                        size="xs"
                        loading={mutation.isPending}
                        disabled={!categoryName.trim()}
                        onClick={() => mutation.mutate(() =>
                          createAdminCategory({ name: categoryName.trim() }).then(() => {
                            setCategoryName("");
                            setShowCategoryForm(false);
                          }),
                        )}
                      >
                        Create category
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              )}

              <TextInput
                aria-label="Search categories"
                placeholder="Search categories"
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
            </Stack>

            <Divider />
            <Stack gap="xs" p="sm" className={classes.scrollArea}>
              {query.isLoading && <Loader size="sm" m="md" />}
              {!query.isLoading && visibleCategories.length === 0 && (
                <EmptyState title="No categories found" description={search ? "Try a different search term." : `There are no ${archived ? "archived" : "active"} categories.`} />
              )}
              {visibleCategories.map((category) => {
                const selected = selectedCategory?.id === category.id;
                return (
                  <Box key={category.id} className={classes.categoryRow} data-selected={selected || undefined}>
                    <UnstyledButton
                      className={classes.categoryButton}
                      onClick={() => {
                        setSelectedCategoryId(category.id);
                        setSubcategorySearch("");
                      }}
                      aria-pressed={selected}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Box className={classes.rowCopy}>
                          <Text fw={650} truncate>{category.name}</Text>
                          <Text size="xs" c={selected ? "brand.1" : "dimmed"}>
                            {category.current_event_count} current · {category.ever_used_event_count} ever used
                          </Text>
                        </Box>
                        <Group gap={6} wrap="nowrap">
                          <Badge variant={selected ? "filled" : "light"} color={selected ? "brand" : "gray"} size="sm">
                            {category.subcategories.length}
                          </Badge>
                          <IconChevronRight className={classes.chevron} size={17} />
                        </Group>
                      </Group>
                    </UnstyledButton>
                    {canManage && (
                      <ActionIcon
                        variant="subtle"
                        color={selected ? "brand.1" : "gray"}
                        aria-label={`Manage ${category.name}`}
                        onClick={() => openActions("category", category)}
                      >
                        <IconDots size={18} />
                      </ActionIcon>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 7 }}>
          <Card withBorder p={0} h="100%" className={classes.panel}>
            <Stack gap="md" p="lg">
              <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                  <ThemeIcon variant="light" color="brand"><IconTags size={18} /></ThemeIcon>
                  <div>
                    <Text fw={700}>Subcategories</Text>
                    <Text size="xs" c="dimmed">
                      {selectedCategory ? `Within ${selectedCategory.name}` : "Select a category first"}
                    </Text>
                  </div>
                </Group>
                {!archived && canManage && selectedCategory && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconPlus size={15} />}
                    onClick={() => setShowBatchForm((value) => !value)}
                  >
                    Add
                  </Button>
                )}
              </Group>

              {showBatchForm && !archived && canManage && selectedCategory && (
                <Paper withBorder p="sm" className={classes.formSurface}>
                  <Stack gap="xs">
                    <Textarea
                      label="Subcategory names"
                      description="Enter one name per line (up to 100)."
                      placeholder={"Concerts\nFestivals\nNightlife"}
                      minRows={3}
                      value={batch}
                      onChange={(event) => setBatch(event.currentTarget.value)}
                    />
                    <Group justify="flex-end" gap="xs">
                      <Button variant="subtle" color="gray" size="xs" onClick={() => setShowBatchForm(false)}>Cancel</Button>
                      <Button
                        size="xs"
                        loading={mutation.isPending}
                        disabled={!batch.trim()}
                        onClick={() => mutation.mutate(() =>
                          createAdminSubcategories(
                            selectedCategory.id,
                            batch.split("\n").map((name) => ({ name: name.trim() })).filter((row) => row.name),
                          ).then(() => {
                            setBatch("");
                            setShowBatchForm(false);
                          }),
                        )}
                      >
                        Add subcategories
                      </Button>
                    </Group>
                  </Stack>
                </Paper>
              )}

              <TextInput
                aria-label="Search subcategories"
                placeholder="Search subcategories"
                leftSection={<IconSearch size={16} />}
                value={subcategorySearch}
                disabled={!selectedCategory}
                onChange={(event) => setSubcategorySearch(event.currentTarget.value)}
              />
            </Stack>

            <Divider />
            <Stack gap="xs" p="sm" className={classes.scrollArea}>
              {!selectedCategory && <EmptyState title="Select a category" description="Its subcategories will appear here." />}
              {selectedCategory && visibleSubcategories.length === 0 && (
                <EmptyState title="No subcategories found" description={subcategorySearch ? "Try a different search term." : "This category has no subcategories yet."} />
              )}
              {visibleSubcategories.map((item) => (
                <Paper key={item.id} withBorder p="md" className={classes.subcategoryRow}>
                  <Group justify="space-between" wrap="nowrap">
                    <Box className={classes.rowCopy}>
                      <Text fw={600} truncate>{item.name}</Text>
                      <Text size="xs" c="dimmed">
                        {item.current_event_count} current · {item.ever_used_event_count} ever used
                      </Text>
                    </Box>
                    {canManage && (
                      <ActionIcon variant="subtle" color="gray" aria-label={`Manage ${item.name}`} onClick={() => openActions("subcategory", item)}>
                        <IconDots size={18} />
                      </ActionIcon>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Modal
        opened={!!lifecycle}
        onClose={() => setLifecycle(null)}
        title={<Text fw={700}>Manage {lifecycle?.item.name ?? "taxonomy"}</Text>}
        size="lg"
      >
        <Stack gap="lg">
          {impact.isLoading && <Loader size="sm" />}
          {impact.data && (
            <Paper withBorder p="md" className={classes.impactSurface}>
              <Text size="sm" fw={700} mb="sm">Assignment impact</Text>
              <Group grow>
                <Metric value={impact.data.impact.current_events} label="Current" />
                <Metric value={impact.data.impact.eligible_events} label="Eligible" />
                <Metric value={impact.data.impact.historical_events} label="Historical" />
              </Group>
            </Paper>
          )}

          <Stack gap="xs">
            <Text fw={700} size="sm">Display details</Text>
            <Group align="flex-end">
              <TextInput label="Display name" value={editName} onChange={(event) => setEditName(event.currentTarget.value)} style={{ flex: 1 }} />
              <Button
                variant="light"
                loading={mutation.isPending}
                disabled={!editName.trim() || editName.trim() === lifecycle?.item.name}
                onClick={() => mutation.mutate(() => updateAdminTaxonomy(lifecycle!.type, lifecycle!.item.id, {
                  name: editName.trim(),
                  description: lifecycle!.item.description,
                  sort_order: lifecycle!.item.sort_order,
                }))}
              >
                Save
              </Button>
            </Group>
            <Text size="xs" c="dimmed">The public slug remains unchanged when the display name changes.</Text>
          </Stack>

          <Divider />

          {!archived ? (
            <Stack gap="md">
              <div>
                <Text fw={700} size="sm">Archive or merge</Text>
                <Text size="xs" c="dimmed" mt={2}>These actions affect future assignment. Existing event references remain unless migrated.</Text>
              </div>
              <Textarea required label="Reason" description="Minimum 10 characters. This is recorded in the audit trail." value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
              <Select
                clearable
                searchable
                label="Replacement target"
                description="Optional for archive; required for migration or merge."
                placeholder="Choose a compatible target"
                value={targetId}
                onChange={setTargetId}
                data={(lifecycle?.type === "category" ? categories : selectedCategory?.subcategories ?? [])
                  .filter((item) => item.id !== lifecycle?.item.id)
                  .map((item) => ({ value: String(item.id), label: item.name }))}
              />
              <Group justify="flex-end">
                <Button
                  color="yellow"
                  variant="light"
                  leftSection={<IconArchive size={16} />}
                  disabled={reason.trim().length < 10}
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate(() => archiveTaxonomy(lifecycle!.type, lifecycle!.item.id, { operation_key: crypto.randomUUID(), reason, scope: "NONE" }))}
                >
                  Archive only
                </Button>
                {targetId && lifecycle?.type === "subcategory" && (
                  <Button
                    color="orange"
                    variant="light"
                    disabled={reason.trim().length < 10}
                    loading={mutation.isPending}
                    onClick={() => mutation.mutate(() => archiveTaxonomy(lifecycle!.type, lifecycle!.item.id, { operation_key: crypto.randomUUID(), reason, scope: "ELIGIBLE", target_id: Number(targetId) }))}
                  >
                    Archive + migrate
                  </Button>
                )}
                {targetId && (
                  <Button
                    color="red"
                    disabled={reason.trim().length < 10}
                    loading={mutation.isPending}
                    onClick={() => mutation.mutate(() => mergeTaxonomy(lifecycle!.type, lifecycle!.item.id, { operation_key: crypto.randomUUID(), reason, scope: "NONE", target_id: Number(targetId) }))}
                  >
                    Merge
                  </Button>
                )}
              </Group>
            </Stack>
          ) : (
            <Stack gap="md">
              <div>
                <Text fw={700} size="sm">Archived taxonomy</Text>
                <Text size="xs" c="dimmed" mt={2}>Restore this item for future assignment, or permanently delete it when safe.</Text>
              </div>
              <Group justify="flex-end">
                <Button variant="light" loading={mutation.isPending} onClick={() => mutation.mutate(() => restoreTaxonomy(lifecycle!.type, lifecycle!.item.id))}>Restore</Button>
                {impact.data?.impact.can_delete && (
                  <Button color="red" loading={mutation.isPending} onClick={() => mutation.mutate(() => deleteTaxonomy(lifecycle!.type, lifecycle!.item.id))}>Delete permanently</Button>
                )}
              </Group>
            </Stack>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <Stack align="center" gap={4} py="xl" px="md">
      <ThemeIcon variant="light" color="gray" size="lg"><IconTags size={18} /></ThemeIcon>
      <Text size="sm" fw={600}>{title}</Text>
      <Text size="xs" c="dimmed" ta="center">{description}</Text>
    </Stack>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <Box>
      <Text fw={750} fz="lg">{value}</Text>
      <Text size="xs" c="dimmed">{label}</Text>
    </Box>
  );
}
