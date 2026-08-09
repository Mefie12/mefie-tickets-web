"use client";

import { Group, Select, Text } from "@mantine/core";
import type { ComboboxItem, ComboboxParsedItem } from "@mantine/core";
import { CURRENCIES, CURRENCIES_BY_CODE } from "@/lib/currencies";

const SELECT_DATA: ComboboxItem[] = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));

/**
 * The one currency picker used everywhere in the app a currency is
 * chosen — the event Details tab. Always stores the ISO 4217 code
 * (e.g. "GBP"), never a symbol — see App\Rules\ValidIsoCurrencyCode on
 * the backend for why: `$` alone is ambiguous across USD/CAD/AUD/etc.
 *
 * Prop shape is a structural drop-in for `@mantine/form`'s
 * `getInputProps()` output, same as CountrySelector/TimezoneSelector.
 */
export function CurrencySelector({
  value,
  onChange,
  error,
  label,
  description,
  placeholder = "Select a currency",
  required,
  disabled,
  "aria-label": ariaLabel,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
  error?: React.ReactNode;
  label?: React.ReactNode;
  description?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const selected = value ? CURRENCIES_BY_CODE.get(value) : undefined;

  return (
    <Select
      label={label}
      description={description}
      aria-label={!label ? (ariaLabel ?? "Currency") : ariaLabel}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      error={error}
      value={value}
      onChange={onChange}
      data={SELECT_DATA}
      searchable
      // Mantine seeds the search box with the selected label and only
      // resets it on blur, so typing would APPEND to it. Selecting the
      // text on focus makes the first keystroke replace it.
      onFocus={(event) => event.currentTarget.select()}
      nothingFoundMessage="No matching currency"
      leftSection={
        selected ? (
          <Text size="xs" c="dimmed" aria-hidden="true">
            {selected.symbol}
          </Text>
        ) : undefined
      }
      leftSectionWidth={36}
      limit={100}
      filter={({ options, search }) => {
        const query = search.trim().toLowerCase();
        if (!query) return options;

        return (options as ComboboxParsedItem[]).filter((option) => {
          if (!("value" in option)) return false;
          const currency = CURRENCIES_BY_CODE.get(option.value);
          if (!currency) return false;
          return (
            currency.code.toLowerCase().startsWith(query) ||
            currency.name.toLowerCase().includes(query) ||
            currency.aliases.some((alias) => alias.includes(query))
          );
        });
      }}
      renderOption={({ option }) => {
        const currency = CURRENCIES_BY_CODE.get(option.value);
        return (
          <Group gap="xs" justify="space-between" wrap="nowrap" w="100%">
            <Text size="sm">
              {currency?.code} — {currency?.name}
            </Text>
            <Text size="xs" c="dimmed">
              {currency?.symbol}
            </Text>
          </Group>
        );
      }}
    />
  );
}
