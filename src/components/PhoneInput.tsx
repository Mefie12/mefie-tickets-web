"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Group, Input, Select, Text, TextInput } from "@mantine/core";
import type { ComboboxItem, ComboboxParsedItem } from "@mantine/core";
import { AsYouType, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import { COUNTRIES } from "@/lib/countries";
import { browserCountryCode, normalizePhoneNumber } from "@/lib/phone";

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
const DIAL_COUNTRY_CODES = new Set(DIAL_COUNTRIES_BY_CODE.keys());
const COUNTRY_SELECT_DATA: ComboboxItem[] = DIAL_COUNTRIES.map((c) => ({ value: c.code, label: `+${c.dialCode}` }));

/**
 * Country-code + formatted national number, backed by libphonenumber-js.
 * Value/onChange operate on a single E.164 string ("+447911123456" or
 * ""), so this drops into every existing `phone: string` /
 * `phone?: string | null` call site with zero wire-shape changes — same
 * role `CountrySelector` plays for `country`. Required phone fields use the
 * browser locale as a convenient initial country; optional fields remain
 * blank until the user starts entering a number. Users can always choose a
 * different country.
 */
export function PhoneInput({
  value,
  onChange,
  error,
  label,
  placeholder,
  required,
  disabled,
  size,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  error?: React.ReactNode;
  label?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  size?: string;
}) {
  const initial = value ? parsePhoneNumberFromString(value) : undefined;
  const [country, setCountry] = useState<CountryCode | null>(initial?.country ?? null);
  const [national, setNational] = useState<string>(initial ? initial.formatNational() : (value ?? ""));
  // `useSyncExternalStore` makes the browser-only locale available after
  // hydration without a state-setting effect or a server/client mismatch.
  const browserDefaultCountry = useSyncExternalStore(
    () => () => {},
    () => browserCountryCode(DIAL_COUNTRY_CODES),
    () => null,
  );
  const activeCountry = country ?? (required && !value && !national ? browserDefaultCountry : null);
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
    const e164 = nextCountry && nextNational.trim() ? normalizePhoneNumber(nextNational, nextCountry) : "";
    lastEmitted.current = e164;
    onChange(e164);
  }

  function handleCountryChange(nextValue: string | null) {
    const nextCountry = (nextValue as CountryCode | null) ?? null;
    setCountry(nextCountry);
    emit(nextCountry, national);
  }

  function handleNationalChange(raw: string) {
    const formatted = activeCountry ? new AsYouType(activeCountry).input(raw) : raw;
    setNational(formatted);
    emit(activeCountry, formatted);
  }

  return (
    <Input.Wrapper label={label} required={required} error={error} size={size}>
      <Group gap={6} wrap="nowrap" align="flex-start" w="100%">
        <Select
          aria-label="Country or calling code"
          placeholder="Code"
          data={COUNTRY_SELECT_DATA}
          value={activeCountry}
          onChange={handleCountryChange}
          disabled={disabled}
          error={!!error}
          size={size}
          searchable
          autoComplete="tel-country-code"
          comboboxProps={{ width: 260, position: "bottom-start" }}
          // Fits a flag + a 4-digit dial code (e.g. "+233", "+1876")
          // without truncation. Tightened section widths keep it compact
          // even so; the full country name lives in the dropdown.
          // flex:0 0 auto so it never grows at the number field's expense
          // (the number field gets the whole rest of its own row).
          flex="0 0 auto"
          w={116}
          leftSectionWidth={26}
          rightSectionWidth={26}
          onFocus={(event) => event.currentTarget.select()}
          nothingFoundMessage="No matching country"
          leftSection={activeCountry ? <span aria-hidden="true">{DIAL_COUNTRIES_BY_CODE.get(activeCountry)?.flag}</span> : undefined}
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
          placeholder={placeholder ?? (activeCountry ? "Local phone number" : "Phone number")}
          type="tel"
          inputMode="tel"
          size={size}
          autoComplete="tel-national"
          value={national}
          onChange={(event) => handleNationalChange(event.currentTarget.value)}
          disabled={disabled}
          error={!!error}
          // flex:1 + miw:0 so the number field takes all remaining room
          // and can still shrink on a very narrow container instead of
          // pushing the country selector out or overflowing the row.
          flex="1 1 auto"
          miw={0}
        />
      </Group>
    </Input.Wrapper>
  );
}
