"use client";

import { Group, Select, Text } from "@mantine/core";
import type { ComboboxItem, ComboboxParsedItem } from "@mantine/core";
import { COUNTRIES, COUNTRIES_BY_CODE } from "@/lib/countries";

const SELECT_DATA: ComboboxItem[] = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

/**
 * The one country picker used everywhere in the app a country is
 * chosen — organizer/event location forms and the checkout ADDRESS
 * question. Always stores the ISO 3166-1 alpha-2 code (e.g. "GB"), never
 * a free-text name, so payments/addresses/tax/analytics/Mapbox all see
 * one consistent value.
 *
 * Prop shape is a structural drop-in for `@mantine/form`'s
 * `getInputProps()` output — `<CountrySelector {...form.getInputProps("country")} />`
 * works with zero other changes to that form's `useForm` setup.
 */
export function CountrySelector({
  value,
  onChange,
  error,
  label,
  placeholder = "Select a country",
  required,
  disabled,
  "aria-label": ariaLabel,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
  error?: React.ReactNode;
  label?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const selected = value ? COUNTRIES_BY_CODE.get(value) : undefined;

  return (
    <Select
      label={label}
      // Every field in this app already has a visible label at every real
      // call site — this only guards against a caller forgetting one, so
      // the control is never unlabeled for screen readers.
      aria-label={!label ? (ariaLabel ?? "Country") : ariaLabel}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      error={error}
      value={value}
      onChange={onChange}
      data={SELECT_DATA}
      searchable
      clearable
      // Mantine seeds the search box with the selected label and only
      // resets it on blur, so typing would APPEND to it ("Ghanauk").
      // Selecting the text on focus makes the first keystroke replace it.
      onFocus={(event) => event.currentTarget.select()}
      nothingFoundMessage="No matching country"
      leftSection={selected ? <span aria-hidden="true">{selected.flag}</span> : undefined}
      filter={({ options, search }) => {
        const query = search.trim().toLowerCase();
        if (!query) return options;

        return (options as ComboboxParsedItem[]).filter((option) => {
          if (!("value" in option)) return false;
          const country = COUNTRIES_BY_CODE.get(option.value);
          if (!country) return false;
          // Aliases match by PREFIX, not substring: several countries carry
          // long native-script or romanized alt names, and a substring
          // match made "UK" surface North Korea (via "Chosŏn Minjujuŭi
          // Inmin Konghwaguk"). Names still match by substring so "united"
          // finds United Kingdom / United States / United Arab Emirates.
          return (
            country.name.toLowerCase().includes(query) || country.aliases.some((alias) => alias.startsWith(query))
          );
        });
      }}
      renderOption={({ option }) => {
        const country = COUNTRIES_BY_CODE.get(option.value);
        return (
          <Group gap="xs" wrap="nowrap">
            <span aria-hidden="true">{country?.flag}</span>
            <Text size="sm">{option.label}</Text>
          </Group>
        );
      }}
    />
  );
}
