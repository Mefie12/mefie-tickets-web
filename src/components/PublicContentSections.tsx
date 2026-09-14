"use client";

import { useState } from "react";
import { ActionIcon, Anchor, Avatar, Button, Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandSoundcloud,
  IconBrandSpotify,
  IconBrandTiktok,
  IconBrandX,
  IconBrandYoutube,
  IconExternalLink,
  IconStarFilled,
  IconWorld,
} from "@tabler/icons-react";
import type { PublicContentSection, PublicLineupItem } from "@/lib/publicEventApi";
import { TALENT_ROLES } from "@/lib/talentApi";

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  TALENT_ROLES.map((r) => [r.value, r.label]),
);

const SOCIAL_ICONS: Record<string, typeof IconWorld> = {
  WEBSITE: IconWorld,
  INSTAGRAM: IconBrandInstagram,
  TIKTOK: IconBrandTiktok,
  YOUTUBE: IconBrandYoutube,
  SPOTIFY: IconBrandSpotify,
  SOUNDCLOUD: IconBrandSoundcloud,
  FACEBOOK: IconBrandFacebook,
  X: IconBrandX,
};

/** Renders after the event description/gallery — see docs/15_event_content_sections_plan.md. Hidden sections are already filtered server-side. */
export function PublicContentSections({ sections }: { sections: PublicContentSection[] }) {
  const visible = sections.filter((s) => s.type === "LINEUP" || s.custom_cards.length > 0);
  if (visible.length === 0) return null;

  return (
    <Stack gap="xl">
      {visible.map((section) => (
        <Stack key={section.id} gap="md">
          <div>
            <Title order={3} fz={22}>
              {section.title}
            </Title>
            {section.intro && (
              <Text size="sm" c="dimmed" mt={4}>
                {section.intro}
              </Text>
            )}
          </div>

          {section.type === "LINEUP" ? (
            <LineupSection items={section.lineup_items} />
          ) : (
            <CustomCardsSection cards={section.custom_cards} />
          )}
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * A responsive card grid — one card per performer, each showing the
 * profile image, name/role, description, and social links together
 * rather than the description hiding behind a click. Featured/
 * headliner items get a slightly larger card and avatar.
 */
function LineupSection({ items }: { items: PublicLineupItem[] }) {
  if (items.length === 0) {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        Lineup TBA
      </Text>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {items.map((item) => (
        <TalentCard key={item.id} item={item} />
      ))}
    </SimpleGrid>
  );
}

function TalentCard({ item }: { item: PublicLineupItem }) {
  const [expanded, setExpanded] = useState(false);
  const bio = item.description || item.biography;
  const showToggle = !!bio && bio.length > 140;

  return (
    <Card withBorder radius="lg" p="lg">
      <Stack gap="sm" align="center" ta="center">
        <Avatar src={item.profile_image_url} size={item.is_featured ? 88 : 72} radius="xl" />
        <Stack gap={2} align="center">
          <Group gap={6} wrap="nowrap" justify="center">
            {item.is_featured && <IconStarFilled size={14} color="var(--mantine-color-yellow-6)" />}
            <Text fw={700} size="md">
              {item.display_name}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {item.custom_role || ROLE_LABELS[item.role] || item.role}
          </Text>
          {item.set_time_label && (
            <Text size="xs" c="dimmed" fw={600}>
              {item.set_time_label}
            </Text>
          )}
        </Stack>
        {item.tagline && (
          <Text size="sm" fs="italic">
            {item.tagline}
          </Text>
        )}
        {bio && (
          <Text size="sm" lineClamp={expanded ? undefined : 3}>
            {bio}
          </Text>
        )}
        {showToggle && (
          <Button variant="subtle" size="compact-xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : "Read more"}
          </Button>
        )}
        {item.social_links && item.social_links.length > 0 && (
          <Group gap={4} justify="center">
            {item.social_links.map((link) => {
              const Icon = SOCIAL_ICONS[link.provider] ?? IconWorld;
              return (
                <ActionIcon
                  key={link.provider}
                  component="a"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="subtle"
                  color="gray"
                  aria-label={`${item.display_name} on ${link.provider.toLowerCase()} (opens in a new tab)`}
                >
                  <Icon size={16} />
                </ActionIcon>
              );
            })}
          </Group>
        )}
      </Stack>
    </Card>
  );
}

function CustomCardsSection({ cards }: { cards: { id: number; title: string; description: string | null; image_url: string | null; link_url: string | null; link_label: string | null }[] }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {cards.map((card) => (
        <Card key={card.id} withBorder radius="lg" p="lg">
          <Stack gap="sm">
            {card.image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- organizer-uploaded image, not a static/known-domain asset worth Next/Image config for
              <img src={card.image_url} alt="" style={{ width: "100%", borderRadius: 12 }} />
            )}
            <Text fw={700}>{card.title}</Text>
            {card.description && <Text size="sm">{card.description}</Text>}
            {card.link_url && (
              <Anchor href={card.link_url} target="_blank" rel="noopener noreferrer" size="sm" fw={600}>
                <Group gap={4} component="span">
                  {card.link_label || "Learn more"}
                  <IconExternalLink size={14} />
                </Group>
              </Anchor>
            )}
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}
