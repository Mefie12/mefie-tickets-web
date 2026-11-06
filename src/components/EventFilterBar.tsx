"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Drawer, Group, Indicator, Select, Stack, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconFilter, IconSearch } from "@tabler/icons-react";
import { CountrySelector } from "@/components/CountrySelector";
import type { PublicEventTaxonomies, PublicEventCategory } from "@/lib/publicEventApi";
import {
  EMPTY_DRAFT,
  buildDiscoverUrl,
  countActiveFilters,
  dateRangeError,
  draftFromParams,
  setDraftCategory,
  type FilterDraft,
} from "@/lib/eventFilters";

/**
 * Every change writes straight into the URL's query string (via
 * router.push) rather than local-only state, so results are
 * refresh-safe and shareable — the landing page itself is a Server
 * Component that re-fetches whenever `searchParams` changes, so no
 * client-side data fetching happens here at all.
 *
 * Matches the Figma "Search controls" pattern: an inline search field
 * plus a "Filters" button that opens the subcategory/country/date
 * fields in a Drawer, rather than showing them inline.
 *
 * The drawer always shows the same fields (Category, Subcategory,
 * Country, From, To) regardless of view. Edits are staged in a local
 * draft and written to the URL once, via "Show results" — so a
 * half-typed date never triggers a server re-fetch under the open
 * drawer.
 *
 * `showCategoryChips` renders the category pill row (All Events + one
 * per taxonomy category) as a quick shortcut on Discover's browse view.
 * It reads and writes the same `category` URL param as the drawer, so
 * the two can never disagree.
 */
export function EventFilterBar({
  taxonomies,
  showCategoryChips = false,
}: {
  taxonomies: PublicEventTaxonomies;
  showCategoryChips?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filtersOpened, setFiltersOpened] = useState(false);

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [debouncedQ] = useDebouncedValue(q, 300);
  const applied = draftFromParams(searchParams);
  const category = applied.category;
  const activeFilterCount = countActiveFilters(applied);

  const [draft, setDraft] = useState<FilterDraft>(applied);
  const selectedCategory = taxonomies.categories.find((c: PublicEventCategory) => c.slug === draft.category);
  const rangeError = dateRangeError(draft);
  const draftCount = countActiveFilters(draft);

  function applyFilters(updates: Record<string, string | null>, options?: { keepBrowse?: boolean }) {
    router.push(buildDiscoverUrl(new URLSearchParams(searchParams.toString()), updates, options));
  }

  function openFilters() {
    setDraft(draftFromParams(searchParams));
    setFiltersOpened(true);
  }

  function applyDraft() {
    if (rangeError) return;
    applyFilters(
      {
        category: draft.category || null,
        subcategory: draft.subcategory || null,
        country: draft.country || null,
        from: draft.from || null,
        to: draft.to || null,
      },
      { keepBrowse: true },
    );
    setFiltersOpened(false);
  }

  useEffect(() => {
    if (debouncedQ !== (searchParams.get("q") ?? "")) {
      applyFilters({ q: debouncedQ || null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  return (
    <>
      <Group gap="md" wrap="nowrap" w="100%">
        <TextInput
          placeholder="Search events"
          leftSection={<IconSearch size={20} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          radius="md"
          size="md"
          style={{ flex: 1 }}
        />
        <Indicator disabled={activeFilterCount === 0} label={activeFilterCount} size={16} offset={4}>
          <Button
            variant="default"
            radius="md"
            size="md"
            leftSection={<IconFilter size={20} />}
            onClick={openFilters}
          >
            Filters
          </Button>
        </Indicator>
      </Group>

      {showCategoryChips && (
        <Group gap={8} wrap="nowrap" style={{ overflowX: "auto" }}>
          <Button
            radius="xl"
            size="sm"
            variant={category ? "default" : "filled"}
            onClick={() => applyFilters({ category: null, subcategory: null }, { keepBrowse: true })}
            style={{ flexShrink: 0 }}
          >
            All Events
          </Button>
          {taxonomies.categories.map((c: PublicEventCategory) => (
            <Button
              key={c.slug}
              radius="xl"
              size="sm"
              variant={category === c.slug ? "filled" : "default"}
              onClick={() => applyFilters({ category: c.slug, subcategory: null })}
              style={{ flexShrink: 0 }}
            >
              {c.name}
            </Button>
          ))}
        </Group>
      )}

      <Drawer opened={filtersOpened} onClose={() => setFiltersOpened(false)} title="Filters" position="right">
        <Stack gap="md">
          <Select
            label="Category"
            placeholder="All categories"
            searchable
            clearable
            data={taxonomies.categories.map((c: PublicEventCategory) => ({ value: c.slug, label: c.name }))}
            value={draft.category || null}
            onChange={(value) => setDraft((d) => setDraftCategory(d, value))}
          />
          <Select
            label="Subcategory"
            placeholder={selectedCategory ? "All subcategories" : "Select a category first"}
            searchable
            clearable
            disabled={!selectedCategory}
            data={(selectedCategory?.subcategories ?? []).map((s) => ({ value: s.slug, label: s.name }))}
            value={draft.subcategory || null}
            onChange={(value) => setDraft((d) => ({ ...d, subcategory: value ?? "" }))}
          />
          <CountrySelector
            label="Country"
            placeholder="Any country"
            value={draft.country ? draft.country.toUpperCase() : null}
            onChange={(value) => setDraft((d) => ({ ...d, country: value ? value.toLowerCase() : "" }))}
          />
          <TextInput
            type="date"
            label="From"
            value={draft.from}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setDraft((d) => ({ ...d, from: value }));
            }}
          />
          <TextInput
            type="date"
            label="To"
            value={draft.to}
            min={draft.from || undefined}
            error={rangeError}
            onChange={(e) => {
              const value = e.currentTarget.value;
              setDraft((d) => ({ ...d, to: value }));
            }}
          />
          <Group grow mt="sm">
            <Button variant="default" disabled={draftCount === 0} onClick={() => setDraft(EMPTY_DRAFT)}>
              Clear all
            </Button>
            <Button disabled={Boolean(rangeError)} onClick={applyDraft}>
              Show results
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}
