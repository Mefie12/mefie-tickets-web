"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Group, Select, SimpleGrid, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { CountrySelector } from "@/components/CountrySelector";
import type { PublicEventTaxonomies, PublicEventCategory } from "@/lib/publicEventApi";

/**
 * Every change writes straight into the URL's query string (via
 * router.push) rather than local-only state, so results are
 * refresh-safe and shareable — the landing page itself is a Server
 * Component that re-fetches whenever `searchParams` changes, so no
 * client-side data fetching happens here at all.
 */
export function EventFilterBar({ taxonomies }: { taxonomies: PublicEventTaxonomies }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [debouncedQ] = useDebouncedValue(q, 300);
  const category = searchParams.get("category") ?? "";
  const subcategory = searchParams.get("subcategory") ?? "";
  const country = searchParams.get("country") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

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
    <Card withBorder radius="lg" p="md">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
        <TextInput
          label="Search"
          placeholder="Search events"
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
        <Select
          label="Category"
          placeholder="All categories"
          searchable
          clearable
          data={taxonomies.categories.map((c: PublicEventCategory) => ({ value: c.slug, label: c.name }))}
          value={category || null}
          onChange={(value) => applyFilters({ category: value, subcategory: null })}
        />
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
      </SimpleGrid>
      {(q || category || subcategory || country || from || to) && (
        <Group justify="flex-end" mt="sm">
          <Button
            variant="subtle"
            size="xs"
            c="dimmed"
            onClick={() => {
              setQ("");
              router.push("/discover");
            }}
          >
            Clear filters
          </Button>
        </Group>
      )}
    </Card>
  );
}
