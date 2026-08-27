"use client";

import { Select, TextInput } from "@mantine/core";
import { RichTextDescription } from "@/components/RichTextDescription";
import type { EventCategory, EventTaxonomyItem } from "@/lib/eventApi";

/** Fields common to every Details form (single event manage/create, series manage/create). */
export type EventDetailsFieldValues = {
  title: string;
  description: string;
  event_category_id: string;
  event_subcategory_id: string;
};

/**
 * Presentational only — owns no form state, no mutation, no save button.
 * Excludes Currency/Audience/Attributes: those are single-event-only
 * concepts today (EventSeries has no editable equivalent), so each
 * single-event call site composes them itself around this component.
 */
export function EventDetailsFields({
  values,
  onChange,
  errors,
  disabled,
  categories,
  currentCategory,
  currentSubcategory,
  titleLabel = "Event title",
  categoryLabel = "Category",
}: {
  values: EventDetailsFieldValues;
  onChange: <K extends keyof EventDetailsFieldValues>(field: K, value: EventDetailsFieldValues[K]) => void;
  errors: Partial<Record<keyof EventDetailsFieldValues, React.ReactNode>>;
  disabled?: boolean;
  categories: EventCategory[];
  currentCategory?: EventTaxonomyItem | null;
  currentSubcategory?: EventTaxonomyItem | null;
  titleLabel?: string;
  categoryLabel?: string;
}) {
  const category = categories.find((item) => String(item.id) === values.event_category_id);

  const categoryOptions = categories.map((item) => ({ value: String(item.id), label: item.name }));
  if (currentCategory && !categoryOptions.some((item) => item.value === String(currentCategory.id))) {
    categoryOptions.push({ value: String(currentCategory.id), label: `${currentCategory.name} (archived)` });
  }

  const subcategoryOptions = (category?.subcategories ?? []).map((item) => ({ value: String(item.id), label: item.name }));
  if (currentSubcategory && !subcategoryOptions.some((item) => item.value === String(currentSubcategory.id))) {
    subcategoryOptions.push({ value: String(currentSubcategory.id), label: `${currentSubcategory.name} (archived)` });
  }

  return (
    <>
      <TextInput
        required
        label={titleLabel}
        value={values.title}
        onChange={(e) => onChange("title", e.currentTarget.value)}
        error={errors.title}
      />
      <RichTextDescription
        disabled={disabled}
        value={values.description}
        onChange={(value) => onChange("description", value)}
        error={errors.description}
      />
      <Select
        searchable
        clearable
        label={categoryLabel}
        placeholder="Select a category"
        data={categoryOptions}
        value={values.event_category_id || null}
        error={errors.event_category_id}
        onChange={(value) => {
          onChange("event_category_id", value ?? "");
          onChange("event_subcategory_id", "");
        }}
      />
      <Select
        searchable
        clearable
        disabled={disabled || !category}
        label="Subcategory (optional)"
        placeholder="Select a subcategory"
        data={subcategoryOptions}
        value={values.event_subcategory_id || null}
        error={errors.event_subcategory_id}
        onChange={(value) => onChange("event_subcategory_id", value ?? "")}
      />
    </>
  );
}
