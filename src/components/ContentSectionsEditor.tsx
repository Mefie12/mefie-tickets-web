"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconDotsVertical,
  IconGripVertical,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconStarFilled,
  IconX,
} from "@tabler/icons-react";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import {
  createContentSection,
  createCustomCard,
  createLineupItem,
  deleteContentSection,
  deleteCustomCard,
  deleteLineupItem,
  listContentSections,
  reorderContentSections,
  reorderCustomCards,
  reorderLineupItems,
  updateContentSection,
  updateCustomCard,
  updateLineupItem,
  uploadCustomCardImage,
  type ContentSection,
  type ContentSectionType,
  type CustomSectionCard,
  type LineupItem,
} from "@/lib/contentSectionApi";
import {
  archiveTalentProfile,
  createTalentProfile,
  listTalentProfiles,
  updateTalentProfile,
  uploadTalentProfileImage,
  TALENT_ROLES,
  type SocialLink,
  type SocialLinkProvider,
  type TalentProfile,
  type TalentRole,
} from "@/lib/talentApi";

const ROLE_OPTIONS = TALENT_ROLES;

const SOCIAL_PROVIDER_OPTIONS: { value: SocialLinkProvider; label: string }[] = [
  { value: "WEBSITE", label: "Website" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "SPOTIFY", label: "Spotify" },
  { value: "SOUNDCLOUD", label: "SoundCloud" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "X", label: "X" },
];

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

/**
 * What to actually show for a lineup role, most specific first: a
 * per-event `role_override` (free text), then a profile-level custom role
 * (only meaningful when `role === "OTHER"`), then the curated label.
 */
function displayRole(role: string, customRole?: string | null, roleOverride?: string | null) {
  if (roleOverride?.trim()) return roleOverride;
  if (role === "OTHER" && customRole?.trim()) return customRole;
  return roleLabel(role);
}

/** A locally-selected file has no URL yet — this is what lets the Dropzone show what was actually picked before it's ever uploaded. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local state from an external system (the browser's Blob URL registry), same justification as LocationAutocomplete.tsx's poll-driven state sync; createObjectURL/revokeObjectURL must pair inside an effect for correct cleanup.
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}

function ImageDropzoneContent({ file, existingUrl, round }: { file: File | null; existingUrl?: string | null; round?: boolean }) {
  const previewUrl = useObjectUrl(file);
  const shown = previewUrl ?? existingUrl;

  if (shown) {
    return (
      <Group justify="center" gap="sm" mih={80} style={{ pointerEvents: "none" }}>
        <Avatar src={shown} size={64} radius={round ? "xl" : "sm"} />
        <Text size="sm">{file ? file.name : "Current image — drop a new one to replace it"}</Text>
      </Group>
    );
  }

  return (
    <Group justify="center" gap="sm" mih={80} style={{ pointerEvents: "none" }}>
      <IconPhoto size={24} opacity={0.5} />
      <Text size="sm">{round ? "Drag a square image here, or click to browse" : "Drag an image here, or click to browse"}</Text>
    </Group>
  );
}

export function ContentSectionsEditor({ eventId, disabled }: { eventId: number; disabled: boolean }) {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const sectionsQuery = useQuery({
    queryKey: ["content-sections", eventId],
    queryFn: () => listContentSections(eventId),
  });
  const talentQuery = useQuery({ queryKey: ["talent-profiles"], queryFn: listTalentProfiles });

  const [addModal, setAddModal] = useState<ContentSectionType | null>(null);

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => reorderContentSections(eventId, ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] }),
  });

  const sections = sectionsQuery.data?.content_sections ?? [];
  const talentProfiles = talentQuery.data?.talent_profiles ?? [];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sections.map((s) => s.id);
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;
    const reordered = [...ids];
    reordered.splice(from, 1);
    reordered.splice(to, 0, Number(active.id));
    reorderMutation.mutate(reordered);
  }

  return (
    <Stack gap="lg">
      <Text size="sm" c="dimmed">
        Add talent lineups, or build a custom section — this content shows on your event page, below the
        description.
      </Text>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <Stack gap="md">
            {sections.map((section) => (
              <SortableSectionCard
                key={section.id}
                section={section}
                eventId={eventId}
                disabled={disabled}
                talentProfiles={talentProfiles}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>

      {!disabled && (
        <Group>
          <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setAddModal("LINEUP")}>
            Add a lineup
          </Button>
          <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setAddModal("CUSTOM")}>
            Add custom section
          </Button>
        </Group>
      )}

      {addModal && (
        <AddSectionModal
          eventId={eventId}
          type={addModal}
          nextSortOrder={sections.length}
          onClose={() => setAddModal(null)}
        />
      )}
    </Stack>
  );
}

function SortableSectionCard({
  section,
  eventId,
  disabled,
  talentProfiles,
}: {
  section: ContentSection;
  eventId: number;
  disabled: boolean;
  talentProfiles: TalentProfile[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const queryClient = useQueryClient();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] });

  const visibilityMutation = useMutation({
    mutationFn: (is_visible: boolean) => updateContentSection(eventId, section.id, { is_visible }),
    onSuccess: invalidate,
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteContentSection(eventId, section.id),
    onSuccess: invalidate,
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  return (
    <Card withBorder radius="lg" p="lg" ref={setNodeRef} style={style}>
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            {!disabled && (
              <ActionIcon variant="subtle" color="gray" {...attributes} {...listeners} style={{ cursor: "grab" }}>
                <IconGripVertical size={16} />
              </ActionIcon>
            )}
            <Badge variant="light" color={section.type === "LINEUP" ? "grape" : "blue"}>
              {section.type === "LINEUP" ? "Lineup" : "Custom"}
            </Badge>
            <Text fw={600} truncate>
              {section.title}
            </Text>
            {!section.is_visible && (
              <Badge variant="outline" color="gray" size="sm">
                Hidden
              </Badge>
            )}
          </Group>
          {!disabled && (
            <Group gap="xs" wrap="nowrap">
              <Tooltip label={section.is_visible ? "Hide on event page" : "Show on event page"}>
                <Switch
                  checked={section.is_visible}
                  onChange={(e) => visibilityMutation.mutate(e.currentTarget.checked)}
                />
              </Tooltip>
              <Menu withinPortal>
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray">
                    <IconDotsVertical size={16} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => setEditing(true)}>Edit title / intro</Menu.Item>
                  <Menu.Item
                    color="red"
                    onClick={() =>
                      modalsConfirmDelete(section, () => deleteMutation.mutate())
                    }
                  >
                    Delete section
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          )}
        </Group>

        {section.intro && (
          <Text size="sm" c="dimmed">
            {section.intro}
          </Text>
        )}

        {section.type === "LINEUP" ? (
          <LineupItemsPanel
            eventId={eventId}
            section={section}
            disabled={disabled}
            talentProfiles={talentProfiles}
          />
        ) : (
          <CustomCardsPanel eventId={eventId} section={section} disabled={disabled} />
        )}
      </Stack>

      {editing && (
        <EditSectionModal eventId={eventId} section={section} onClose={() => setEditing(false)} />
      )}
    </Card>
  );
}

/** Plain confirm() is fine here — this mirrors the low-ceremony delete confirms already used elsewhere for reorderable list items in this app. */
function modalsConfirmDelete(section: ContentSection, onConfirm: () => void) {
  if (window.confirm(`Delete "${section.title}"? This removes everything inside it.`)) {
    onConfirm();
  }
}

function AddSectionModal({
  eventId,
  type,
  nextSortOrder,
  onClose,
}: {
  eventId: number;
  type: ContentSectionType;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm({
    initialValues: { title: type === "LINEUP" ? "Lineup" : "", intro: "" },
    validate: { title: (v) => (v.trim().length === 0 ? "Title is required" : null) },
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      createContentSection(eventId, { type, title: values.title, intro: values.intro || null, sort_order: nextSortOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] });
      onClose();
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(Object.fromEntries(Object.entries(error.errors).map(([f, m]) => [f, m[0]])));
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  return (
    <Modal opened onClose={onClose} title={type === "LINEUP" ? "Add a lineup" : "Add a custom section"}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput required label="Section title" {...form.getInputProps("title")} />
          <Textarea label="Introduction (optional)" autosize minRows={2} {...form.getInputProps("intro")} />
          <Button type="submit" loading={mutation.isPending}>
            Add section
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

function EditSectionModal({ eventId, section, onClose }: { eventId: number; section: ContentSection; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm({
    initialValues: { title: section.title, intro: section.intro ?? "" },
    validate: { title: (v) => (v.trim().length === 0 ? "Title is required" : null) },
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      updateContentSection(eventId, section.id, { title: values.title, intro: values.intro || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] });
      onClose();
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(Object.fromEntries(Object.entries(error.errors).map(([f, m]) => [f, m[0]])));
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  return (
    <Modal opened onClose={onClose} title="Edit section">
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput required label="Section title" {...form.getInputProps("title")} />
          <Textarea label="Introduction (optional)" autosize minRows={2} {...form.getInputProps("intro")} />
          <Button type="submit" loading={mutation.isPending}>
            Save
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

// --- Lineup ---

function LineupItemsPanel({
  eventId,
  section,
  disabled,
  talentProfiles,
}: {
  eventId: number;
  section: ContentSection;
  disabled: boolean;
  talentProfiles: TalentProfile[];
}) {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LineupItem | null>(null);

  const items = section.lineup_items ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => reorderLineupItems(eventId, section.id, ids),
    onSuccess: invalidate,
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;
    const reordered = [...ids];
    reordered.splice(from, 1);
    reordered.splice(to, 0, Number(active.id));
    reorderMutation.mutate(reordered);
  }

  const talentById = new Map(talentProfiles.map((t) => [t.id, t]));
  const [editingTalentProfile, setEditingTalentProfile] = useState<TalentProfile | null>(null);

  if (items.length === 0 && disabled) {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        Lineup TBA
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {items.length === 0 && (
        <Text size="sm" c="dimmed" fs="italic">
          No talent added yet — attendees will see &quot;Lineup TBA&quot; until you add someone.
        </Text>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <Stack gap="xs">
            {items.map((item) => (
              <SortableLineupItemRow
                key={item.id}
                eventId={eventId}
                section={section}
                item={item}
                disabled={disabled}
                needsSync={
                  !!talentById.get(item.talent_profile_id) &&
                  talentById.get(item.talent_profile_id)!.current_version_id !== item.talent_profile_version_id
                }
                onEdit={() => setEditingItem(item)}
                onEditTalentProfile={() => {
                  const profile = talentById.get(item.talent_profile_id);
                  if (profile) setEditingTalentProfile(profile);
                }}
              />
            ))}
          </Stack>
        </SortableContext>
      </DndContext>

      {!disabled && items.length < 20 && (
        <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={() => setPickerOpen(true)} style={{ alignSelf: "flex-start" }}>
          Add talent
        </Button>
      )}

      {pickerOpen && (
        <TalentPickerModal
          eventId={eventId}
          section={section}
          existingTalentIds={items.map((i) => i.talent_profile_id)}
          talentProfiles={talentProfiles}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {editingItem && (
        <LineupItemFormModal eventId={eventId} section={section} item={editingItem} onClose={() => setEditingItem(null)} />
      )}

      {editingTalentProfile && (
        <EditTalentProfileModal talentProfile={editingTalentProfile} onClose={() => setEditingTalentProfile(null)} />
      )}
    </Stack>
  );
}

function SortableLineupItemRow({
  eventId,
  section,
  item,
  disabled,
  needsSync,
  onEdit,
  onEditTalentProfile,
}: {
  eventId: number;
  section: ContentSection;
  item: LineupItem;
  disabled: boolean;
  needsSync: boolean;
  onEdit: () => void;
  onEditTalentProfile: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const queryClient = useQueryClient();
  const router = useRouter();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] });

  const removeMutation = useMutation({
    mutationFn: () => deleteLineupItem(eventId, section.id, item.id),
    onSuccess: invalidate,
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => updateLineupItem(eventId, section.id, item.id, { sync_to_latest: true }),
    onSuccess: () => {
      invalidate();
      notifications.show({ color: "teal", message: "Synced to the latest profile details." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  const version = item.talent_profile_version;

  return (
    <Card withBorder radius="md" p="sm" ref={setNodeRef} style={style}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {!disabled && (
            <ActionIcon variant="subtle" color="gray" {...attributes} {...listeners} style={{ cursor: "grab" }}>
              <IconGripVertical size={16} />
            </ActionIcon>
          )}
          <Avatar src={version?.profile_image_url} radius="xl" />
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              {item.is_featured && <IconStarFilled size={14} color="var(--mantine-color-yellow-6)" />}
              <Text fw={600} truncate>
                {version?.display_name}
              </Text>
            </Group>
            <Text size="xs" c="dimmed" truncate>
              {displayRole(version?.role ?? "", version?.custom_role, item.role_override)}
              {item.set_time_label ? ` · ${item.set_time_label}` : ""}
            </Text>
          </Stack>
        </Group>
        {!disabled && (
          <Group gap="xs" wrap="nowrap">
            {needsSync && (
              <Tooltip label="This talent's profile has updated — sync to show the latest details">
                <ActionIcon variant="light" color="orange" loading={syncMutation.isPending} onClick={() => syncMutation.mutate()}>
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Menu withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={onEdit}>Edit appearance</Menu.Item>
                <Menu.Item onClick={onEditTalentProfile}>Edit talent profile</Menu.Item>
                <Menu.Item color="red" onClick={() => removeMutation.mutate()}>
                  Remove from lineup
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        )}
      </Group>
    </Card>
  );
}

function LineupItemFormModal({
  eventId,
  section,
  item,
  onClose,
}: {
  eventId: number;
  section: ContentSection;
  item: LineupItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm({
    initialValues: {
      role_override: item.role_override ?? "",
      description: item.description ?? "",
      is_featured: item.is_featured,
      set_time_label: item.set_time_label ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      updateLineupItem(eventId, section.id, item.id, {
        role_override: values.role_override || null,
        description: values.description || null,
        is_featured: values.is_featured,
        set_time_label: values.set_time_label || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] });
      onClose();
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  return (
    <Modal opened onClose={onClose} title={`Edit ${item.talent_profile_version?.display_name ?? "appearance"}`}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput
            label="Role override (optional)"
            placeholder={
              item.talent_profile_version
                ? displayRole(item.talent_profile_version.role, item.talent_profile_version.custom_role)
                : undefined
            }
            description="Shown instead of the talent's default role, just for this event"
            {...form.getInputProps("role_override")}
          />
          <Textarea label="Event-specific description (optional)" autosize minRows={2} {...form.getInputProps("description")} />
          <TextInput
            label="Set time (optional)"
            placeholder="e.g. 12:00 AM - 1:00 AM"
            description="A display label shown next to this talent on the event page — not tied to the event's actual schedule"
            {...form.getInputProps("set_time_label")}
          />
          <Switch label="Featured / headliner" {...form.getInputProps("is_featured", { type: "checkbox" })} />
          <Button type="submit" loading={mutation.isPending}>
            Save
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}

function TalentPickerModal({
  eventId,
  section,
  existingTalentIds,
  talentProfiles,
  onClose,
}: {
  eventId: number;
  section: ContentSection;
  existingTalentIds: number[];
  talentProfiles: TalentProfile[];
  onClose: () => void;
}) {
  // Starts on "create" when the library is empty — landing on an empty
  // "Select existing" list with only a small toggle button to escape it
  // reads as a dead end (reported live: "select existing leads nowhere").
  const [mode, setMode] = useState<"select" | "create">(talentProfiles.length === 0 ? "create" : "select");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const router = useRouter();

  // Force a fresh fetch every time the picker opens, rather than trusting
  // the 30s staleTime cache — a talent created moments ago (e.g. from
  // another tab, or just outside the cache window) must never appear
  // missing here.
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["talent-profiles"] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editingTalentProfile, setEditingTalentProfile] = useState<TalentProfile | null>(null);

  const available = talentProfiles.filter(
    (t) => t.status === "ACTIVE" && !existingTalentIds.includes(t.id) && t.current_version.display_name.toLowerCase().includes(search.toLowerCase()),
  );

  const addMutation = useMutation({
    mutationFn: (talentProfileId: number) => createLineupItem(eventId, section.id, { talent_profile_id: talentProfileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] });
      onClose();
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  return (
    <Modal opened onClose={onClose} title="Add talent to lineup" size="lg">
      <Stack>
        <Group gap="xs">
          <Button variant={mode === "select" ? "filled" : "default"} size="xs" onClick={() => setMode("select")}>
            Select existing
          </Button>
          <Button variant={mode === "create" ? "filled" : "default"} size="xs" onClick={() => setMode("create")}>
            Create new
          </Button>
        </Group>

        {mode === "select" ? (
          <Stack gap="sm">
            <TextInput
              placeholder="Search your talent library…"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
            {available.length === 0 ? (
              talentProfiles.length === 0 ? (
                <Stack gap={4} align="flex-start">
                  <Text size="sm" c="dimmed">
                    No talent profiles yet.
                  </Text>
                  <Button variant="light" size="xs" onClick={() => setMode("create")}>
                    Create your first one
                  </Button>
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  No matches.
                </Text>
              )
            ) : (
              <Stack gap={4} mah={320} style={{ overflowY: "auto" }}>
                {available.map((talent) => (
                  <Card key={talent.id} withBorder radius="md" p="xs" style={{ cursor: "pointer" }} onClick={() => addMutation.mutate(talent.id)}>
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap">
                        <Avatar src={talent.current_version.profile_image_url} radius="xl" />
                        <Stack gap={0}>
                          <Text fw={600} size="sm">
                            {talent.current_version.display_name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {displayRole(talent.current_version.role, talent.current_version.custom_role)}
                          </Text>
                        </Stack>
                      </Group>
                      <Tooltip label="Edit this talent profile">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTalentProfile(talent);
                          }}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Stack>
        ) : (
          <TalentProfileForm onSaved={(talentId) => addMutation.mutate(talentId)} submitLabel="Add to lineup" />
        )}
      </Stack>

      {editingTalentProfile && (
        <EditTalentProfileModal talentProfile={editingTalentProfile} onClose={() => setEditingTalentProfile(null)} />
      )}
    </Modal>
  );
}

function TalentProfileForm({
  talentProfile,
  onSaved,
  submitLabel = "Save",
}: {
  talentProfile?: TalentProfile;
  onSaved: (talentProfileId: number) => void;
  submitLabel?: string;
}) {
  const isEdit = !!talentProfile;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const form = useForm({
    initialValues: {
      display_name: talentProfile?.current_version.display_name ?? "",
      role: talentProfile?.current_version.role ?? ("HEADLINER" as TalentRole),
      custom_role: talentProfile?.current_version.custom_role ?? "",
      tagline: talentProfile?.current_version.tagline ?? "",
      biography: talentProfile?.current_version.biography ?? "",
      social_links: talentProfile?.current_version.social_links ?? ([] as SocialLink[]),
    },
    validate: {
      display_name: (v) => (v.trim().length === 0 ? "Name is required" : null),
      custom_role: (v, values) =>
        values.role === "OTHER" && v.trim().length === 0 ? "Enter the role" : null,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      const payload = {
        display_name: values.display_name,
        role: values.role,
        custom_role: values.role === "OTHER" ? values.custom_role.trim() : null,
        tagline: values.tagline || null,
        biography: values.biography || null,
        social_links: values.social_links.length > 0 ? values.social_links : null,
      };
      const saved = isEdit ? await updateTalentProfile(talentProfile.id, payload) : await createTalentProfile(payload);
      // Deliberately caught here, not left to bubble to onError: the
      // profile already exists at this point (created or updated), so a
      // failed image attach should surface as a warning on an otherwise
      // successful save — not orphan/strand it, nor silently swallow the
      // reason (image validation errors have no matching field in this
      // form, so form.setErrors on them would never render anywhere).
      let imageError: string | null = null;
      if (imageFile) {
        try {
          await uploadTalentProfileImage(saved.talent_profile.id, imageFile);
        } catch (error) {
          imageError = error instanceof ApiError ? error.message : "Something went wrong.";
        }
      }
      return { ...saved, imageError };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["talent-profiles"] });
      if (data.imageError) {
        notifications.show({
          color: "orange",
          message: `Saved, but the photo couldn't be uploaded: ${data.imageError}`,
        });
      } else {
        notifications.show({
          color: "teal",
          message: isEdit ? "Talent profile updated." : `${data.talent_profile.current_version.display_name} added to your talent library.`,
        });
      }
      onSaved(data.talent_profile.id);
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(Object.fromEntries(Object.entries(error.errors).map(([f, m]) => [f, m[0]])));
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
      <Stack>
        <TextInput required label="Display / stage name" {...form.getInputProps("display_name")} />
        <Select
          required
          searchable
          nothingFoundMessage="No matching role"
          label="Role"
          description="Pick the closest match, or 'Other' to type your own."
          data={ROLE_OPTIONS}
          {...form.getInputProps("role")}
        />
        {form.values.role === "OTHER" && (
          <TextInput
            withAsterisk
            label="Custom role"
            placeholder="e.g. Puppeteer, Sommelier"
            maxLength={50}
            {...form.getInputProps("custom_role")}
          />
        )}
        <TextInput label="Tagline (optional)" {...form.getInputProps("tagline")} />
        <Textarea label="Biography (optional)" autosize minRows={2} {...form.getInputProps("biography")} />

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Social links (optional)
          </Text>
          {form.values.social_links.map((link, index) => (
            <Group key={index} gap="xs" wrap="nowrap">
              <Select
                data={SOCIAL_PROVIDER_OPTIONS}
                value={link.provider}
                onChange={(v) => form.setFieldValue(`social_links.${index}.provider`, v as SocialLinkProvider)}
                w={140}
              />
              <TextInput
                placeholder="https://…"
                style={{ flex: 1 }}
                value={link.url}
                onChange={(e) => form.setFieldValue(`social_links.${index}.url`, e.currentTarget.value)}
              />
              <ActionIcon variant="subtle" color="red" onClick={() => form.removeListItem("social_links", index)}>
                <IconX size={16} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconPlus size={14} />}
            style={{ alignSelf: "flex-start" }}
            onClick={() => form.insertListItem("social_links", { provider: "WEBSITE", url: "" })}
          >
            Add link
          </Button>
        </Stack>

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Profile image (optional)
          </Text>
          <Dropzone onDrop={(files) => files[0] && setImageFile(files[0])} accept={IMAGE_MIME_TYPE} maxFiles={1} maxSize={5 * 1024 * 1024}>
            <ImageDropzoneContent file={imageFile} existingUrl={talentProfile?.current_version.profile_image_url} round />
          </Dropzone>
        </Stack>

        <Button type="submit" loading={mutation.isPending}>
          {submitLabel}
        </Button>
      </Stack>
    </form>
  );
}

function EditTalentProfileModal({ talentProfile, onClose }: { talentProfile: TalentProfile; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const archiveMutation = useMutation({
    mutationFn: () => archiveTalentProfile(talentProfile.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["talent-profiles"] });
      notifications.show({
        color: "gray",
        message: `${talentProfile.current_version.display_name} archived — no longer addable to new lineups, but stays on events it's already part of.`,
      });
      onClose();
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  return (
    <Modal opened onClose={onClose} title={`Edit ${talentProfile.current_version.display_name}`}>
      <Stack>
        <TalentProfileForm talentProfile={talentProfile} onSaved={() => onClose()} submitLabel="Save changes" />
        <Button
          variant="subtle"
          color="red"
          size="xs"
          loading={archiveMutation.isPending}
          style={{ alignSelf: "flex-start" }}
          onClick={() => {
            if (window.confirm(`Archive ${talentProfile.current_version.display_name}? They can no longer be added to new lineups, but stay on events they're already part of.`)) {
              archiveMutation.mutate();
            }
          }}
        >
          Archive this talent
        </Button>
      </Stack>
    </Modal>
  );
}

// --- Custom cards ---

function CustomCardsPanel({ eventId, section, disabled }: { eventId: number; section: ContentSection; disabled: boolean }) {
  const queryClient = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [modalCard, setModalCard] = useState<CustomSectionCard | "new" | null>(null);

  const cards = section.custom_cards ?? [];
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] });

  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) => reorderCustomCards(eventId, section.id, ids),
    onSuccess: invalidate,
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = cards.map((c) => c.id);
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    if (from === -1 || to === -1) return;
    const reordered = [...ids];
    reordered.splice(from, 1);
    reordered.splice(to, 0, Number(active.id));
    reorderMutation.mutate(reordered);
  }

  return (
    <Stack gap="sm">
      {cards.length === 0 && (
        <Text size="sm" c="dimmed" fs="italic">
          No cards yet.
        </Text>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {cards.map((card) => (
              <SortableCustomCard
                key={card.id}
                eventId={eventId}
                section={section}
                card={card}
                disabled={disabled}
                onEdit={() => setModalCard(card)}
              />
            ))}
          </SimpleGrid>
        </SortableContext>
      </DndContext>

      {!disabled && cards.length < 20 && (
        <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModalCard("new")} style={{ alignSelf: "flex-start" }}>
          Add card
        </Button>
      )}

      {modalCard && (
        <CustomCardFormModal
          eventId={eventId}
          section={section}
          card={modalCard === "new" ? null : modalCard}
          onClose={() => setModalCard(null)}
        />
      )}
    </Stack>
  );
}

function SortableCustomCard({
  eventId,
  section,
  card,
  disabled,
  onEdit,
}: {
  eventId: number;
  section: ContentSection;
  card: CustomSectionCard;
  disabled: boolean;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const queryClient = useQueryClient();
  const router = useRouter();

  const removeMutation = useMutation({
    mutationFn: () => deleteCustomCard(eventId, section.id, card.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] }),
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  return (
    <Card withBorder radius="md" p="sm" ref={setNodeRef} style={style}>
      <Group justify="space-between" wrap="nowrap" mb={4}>
        <Group gap="xs" wrap="nowrap">
          {!disabled && (
            <ActionIcon variant="subtle" color="gray" {...attributes} {...listeners} style={{ cursor: "grab" }}>
              <IconGripVertical size={16} />
            </ActionIcon>
          )}
          <Text fw={600} size="sm" truncate>
            {card.title}
          </Text>
        </Group>
        {!disabled && (
          <Menu withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={onEdit}>Edit</Menu.Item>
              <Menu.Item color="red" onClick={() => removeMutation.mutate()}>
                Remove
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      {card.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- organizer-uploaded, arbitrary remote-ish origin; not worth Next/Image's static-domain config for a preview thumbnail
        <img src={card.image_url} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />
      )}
      {card.description && (
        <Text size="xs" c="dimmed" lineClamp={2}>
          {card.description}
        </Text>
      )}
    </Card>
  );
}

function CustomCardFormModal({
  eventId,
  section,
  card,
  onClose,
}: {
  eventId: number;
  section: ContentSection;
  card: CustomSectionCard | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const isEdit = card !== null;
  const form = useForm({
    initialValues: {
      title: card?.title ?? "",
      description: card?.description ?? "",
      link_url: card?.link_url ?? "",
      link_label: card?.link_label ?? "",
    },
    validate: { title: (v) => (v.trim().length === 0 ? "Title is required" : null) },
  });

  const mutation = useMutation({
    mutationFn: async (values: typeof form.values) => {
      const payload = {
        title: values.title,
        description: values.description || null,
        link_url: values.link_url || null,
        link_label: values.link_label || null,
      };
      const result = isEdit
        ? await updateCustomCard(eventId, section.id, card.id, payload)
        : await createCustomCard(eventId, section.id, payload);
      // Same reasoning as CreateTalentForm: the card already exists by
      // this point, and "image" has no matching field in this form, so
      // a failure here must be surfaced as a notification, not swallowed
      // via form.setErrors or left to abort the whole save.
      let imageError: string | null = null;
      if (imageFile) {
        try {
          await uploadCustomCardImage(eventId, section.id, result.custom_section_card.id, imageFile);
        } catch (error) {
          imageError = error instanceof ApiError ? error.message : "Something went wrong.";
        }
      }
      return { ...result, imageError };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["content-sections", eventId] });
      if (data.imageError) {
        notifications.show({ color: "orange", message: `Card saved, but the image couldn't be uploaded: ${data.imageError}` });
      }
      onClose();
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(Object.fromEntries(Object.entries(error.errors).map(([f, m]) => [f, m[0]])));
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  return (
    <Modal opened onClose={onClose} title={isEdit ? "Edit card" : "Add card"}>
      <form onSubmit={form.onSubmit((values) => mutation.mutate(values))}>
        <Stack>
          <TextInput required label="Title" {...form.getInputProps("title")} />
          <Textarea label="Description (optional)" autosize minRows={2} {...form.getInputProps("description")} />
          <TextInput label="Link (optional)" placeholder="https://…" {...form.getInputProps("link_url")} />
          <TextInput label="Button label (optional)" placeholder="Learn more" {...form.getInputProps("link_label")} />
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Image (optional)
            </Text>
            <Dropzone onDrop={(files) => files[0] && setImageFile(files[0])} accept={IMAGE_MIME_TYPE} maxFiles={1} maxSize={5 * 1024 * 1024}>
              <ImageDropzoneContent file={imageFile} existingUrl={card?.image_url} />
            </Dropzone>
          </Stack>
          <Button type="submit" loading={mutation.isPending}>
            Save
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
