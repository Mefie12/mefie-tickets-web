"use client";

import { useEffect, useState } from "react";
import { Combobox, Loader, Text, TextInput, useCombobox } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { geocodeAddress, type MapboxSuggestion } from "@/lib/mapbox";

/**
 * Debounced Mapbox address search — a plain text input with a
 * suggestions dropdown, not an embedded map. Only ever renders when a
 * Mapbox token is configured (the parent form decides that; see
 * `mapboxTokenConfigured()` in src/lib/mapbox.ts) — keeping the
 * graceful-degradation check in one place rather than duplicating it
 * here.
 *
 * Deliberately does not own city/state/postal_code/country/coordinates
 * itself — `onSelect` hands the full suggestion to the parent, which
 * writes those sibling fields, so they stay visibly editable afterward
 * rather than being silently owned by this component.
 */
export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  countryIso2,
  label,
  error,
  disabled,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: MapboxSuggestion) => void;
  countryIso2: string | null;
  label?: React.ReactNode;
  error?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
}) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [debouncedValue] = useDebouncedValue(value, 300);

  useEffect(() => {
    let cancelled = false;
    if (debouncedValue.trim().length < 3) {
      // Clearing stale results the instant the query drops below the
      // search threshold is the point of this effect (synchronizing
      // with the debounced Mapbox fetch below) — not derivable state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    setLoading(true);
    geocodeAddress(debouncedValue, countryIso2).then((results) => {
      if (cancelled) return;
      setSuggestions(results);
      setLoading(false);
      if (results.length > 0) combobox.openDropdown();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue, countryIso2]);

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(optionValue) => {
        const suggestion = suggestions[Number(optionValue)];
        if (suggestion) {
          onSelect(suggestion);
          onChange(suggestion.address_line1 ?? suggestion.displayLabel);
        }
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <TextInput
          label={label}
          error={error}
          disabled={disabled}
          required={required}
          value={value}
          rightSection={loading ? <Loader size={16} /> : null}
          onChange={(event) => {
            onChange(event.currentTarget.value);
            combobox.updateSelectedOptionIndex();
          }}
          onFocus={() => {
            if (suggestions.length > 0) combobox.openDropdown();
          }}
          onBlur={() => combobox.closeDropdown()}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {suggestions.length === 0 ? (
            <Combobox.Empty>No matching address</Combobox.Empty>
          ) : (
            suggestions.map((suggestion, index) => (
              <Combobox.Option value={String(index)} key={`${suggestion.latitude},${suggestion.longitude},${index}`}>
                <Text size="sm">{suggestion.displayLabel}</Text>
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
