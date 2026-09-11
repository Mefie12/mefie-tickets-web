"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Drawer, Group, Indicator, Select, Stack, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconFilter, IconSearch } from "@tabler/icons-react";
import { CountrySelector } from "@/components/CountrySelector";
import type { PublicEventTaxonomies, PublicEventCategory } from "@/lib/publicEventApi";

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
 * `showCategoryChips` renders the "general-event-listing" category
 * pill row (All Events + one per taxonomy category) in place of the
 * drawer's category dropdown — used only on Discover's browse/filtered
 * view, not the curated landing state, per the Figma frames (the
 * curated Discover page has no chip row).
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
  const category = searchParams.get("category") ?? "";
  const subcategory = searchParams.get("subcategory") ?? "";
  const country = searchParams.get("country") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const activeFilterCount = [category, subcategory, country, from, to].filter(Boolean).length;

  const selectedCategory = taxonomies.categories.find((c: PublicEventCategory) => c.slug === category);

  function applyFilters(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `/discover?${query}` : "/discover");
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
            onClick={() => setFiltersOpened(true)}
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
            onClick={() => applyFilters({ category: null, subcategory: null })}
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
          {!showCategoryChips && (
            <Select
              label="Category"
              placeholder="All categories"
              searchable
              clearable
              data={taxonomies.categories.map((c: PublicEventCategory) => ({ value: c.slug, label: c.name }))}
              value={category || null}
              onChange={(value) => applyFilters({ category: value, subcategory: null })}
            />
          )}
          <Select
            label="Subcategory"
            placeholder={selectedCategory ? "All subcategories" : "Select a category first"}
            searchable
            clearable
            disabled={!selectedCategory}
            data={(selectedCategory?.subcategories ?? []).map((s) => ({ value: s.slug, label: s.name }))}
            value={subcategory || null}
            onChange={(value) => applyFilters({ subcategory: value })}
          />
          <CountrySelector
            label="Country"
            placeholder="Any country"
            value={country ? country.toUpperCase() : null}
            onChange={(value) => applyFilters({ country: value ? value.toLowerCase() : null })}
          />
          <TextInput
            type="date"
            label="From"
            value={from}
            onChange={(e) => applyFilters({ from: e.currentTarget.value || null })}
          />
          <TextInput
            type="date"
            label="To"
            value={to}
            onChange={(e) => applyFilters({ to: e.currentTarget.value || null })}
          />
          {activeFilterCount > 0 && (
            <Button
              variant="subtle"
              c="dimmed"
              onClick={() => {
                applyFilters({ category: null, subcategory: null, country: null, from: null, to: null });
              }}
            >
              Clear filters
            </Button>
          )}
        </Stack>
      </Drawer>
    </>
  );
}
