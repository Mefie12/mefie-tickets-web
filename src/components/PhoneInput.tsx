"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Input, Select, Text, TextInput } from "@mantine/core";
import type { ComboboxItem, ComboboxParsedItem } from "@mantine/core";
import { AsYouType, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import { COUNTRIES } from "@/lib/countries";

type DialCountry = { code: CountryCode; name: string; flag: string; dialCode: string };

/**
 * `lib/countries.ts`'s `Country` type has no calling-code field — derive
 * one here from libphonenumber-js's own metadata rather than extending
 * that shared type, since dial codes are only ever needed by phone
 * inputs. A handful of `COUNTRIES` entries (e.g. disputed territories)
 * have no calling code in libphonenumber-js's metadata; skip those.
 */
const DIAL_COUNTRIES: DialCountry[] = COUNTRIES.flatMap((c) => {
  try {
    return [{ code: c.code as CountryCode, name: c.name, flag: c.flag, dialCode: getCountryCallingCode(c.code as CountryCode) }];
  } catch {
    return [];
  }
});
const DIAL_COUNTRIES_BY_CODE: Map<string, DialCountry> = new Map(DIAL_COUNTRIES.map((c) => [c.code, c]));
const COUNTRY_SELECT_DATA: ComboboxItem[] = DIAL_COUNTRIES.map((c) => ({ value: c.code, label: `+${c.dialCode}` }));

/**
 * Country-code + formatted national number, backed by libphonenumber-js.
 * Value/onChange operate on a single E.164 string ("+447911123456" or
 * ""), so this drops into every existing `phone: string` /
 * `phone?: string | null` call site with zero wire-shape changes — same
 * role `CountrySelector` plays for `country`. No pre-selected default,
 * matching `CountrySelector`'s convention.
 */
export function PhoneInput({
  value,
  onChange,
  error,
  label,
  placeholder,
  required,
  disabled,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  error?: React.ReactNode;
  label?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const initial = value ? parsePhoneNumberFromString(value) : undefined;
  const [country, setCountry] = useState<CountryCode | null>(initial?.country ?? null);
  const [national, setNational] = useState<string>(initial ? initial.formatNational() : (value ?? ""));
  // Tracks the last E.164 value *we* emitted, so a `value` prop that
  // merely echoes our own onChange doesn't re-parse and clobber
  // in-progress typing — only a genuinely external change (form reset,
  // loading a saved number) triggers a re-sync.
  const lastEmitted = useRef<string>(value ?? "");

  useEffect(() => {
    if ((value ?? "") === lastEmitted.current) return;
    lastEmitted.current = value ?? "";
    const reparsed = value ? parsePhoneNumberFromString(value) : undefined;
    setCountry(reparsed?.country ?? null);
    setNational(reparsed ? reparsed.formatNational() : (value ?? ""));
  }, [value]);

  function emit(nextCountry: CountryCode | null, nextNational: string) {
    const e164 = nextCountry && nextNational.trim() ? (parsePhoneNumberFromString(nextNational, nextCountry)?.number ?? "") : "";
    lastEmitted.current = e164;
    onChange(e164);
  }

  function handleCountryChange(nextValue: string | null) {
    const nextCountry = (nextValue as CountryCode | null) ?? null;
    setCountry(nextCountry);
    emit(nextCountry, national);
  }

  function handleNationalChange(raw: string) {
    const formatted = country ? new AsYouType(country).input(raw) : raw;
    setNational(formatted);
    emit(country, formatted);
  }

  return (
    <Input.Wrapper label={label} required={required} error={error}>
      <Group gap={6} wrap="nowrap" align="flex-start">
        <Select
          aria-label="Country code"
          placeholder="Country"
          data={COUNTRY_SELECT_DATA}
          value={country}
          onChange={handleCountryChange}
          disabled={disabled}
          error={!!error}
          searchable
          w={112}
          onFocus={(event) => event.currentTarget.select()}
          nothingFoundMessage="No matching country"
          leftSection={country ? <span aria-hidden="true">{DIAL_COUNTRIES_BY_CODE.get(country)?.flag}</span> : undefined}
          filter={({ options, search }) => {
            const query = search.trim().replace(/^\+/, "").toLowerCase();
            if (!query) return options;

            return (options as ComboboxParsedItem[]).filter((option) => {
              if (!("value" in option)) return false;
              const dialCountry = DIAL_COUNTRIES_BY_CODE.get(option.value);
              if (!dialCountry) return false;

              return dialCountry.name.toLowerCase().includes(query) || dialCountry.dialCode.startsWith(query);
            });
          }}
          renderOption={({ option }) => {
            const dialCountry = DIAL_COUNTRIES_BY_CODE.get(option.value);
            return (
              <Group gap="xs" wrap="nowrap">
                <span aria-hidden="true">{dialCountry?.flag}</span>
                <Text size="sm">{dialCountry?.name}</Text>
                <Text size="sm" c="dimmed">
                  +{dialCountry?.dialCode}
                </Text>
              </Group>
            );
          }}
        />
        <TextInput
          aria-label={typeof label === "string" ? label : "Phone number"}
          placeholder={placeholder ?? "Phone number"}
          value={national}
          onChange={(event) => handleNationalChange(event.currentTarget.value)}
          disabled={disabled}
          error={!!error}
          style={{ flex: 1 }}
        />
      </Group>
    </Input.Wrapper>
  );
}
