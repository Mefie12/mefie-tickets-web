"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@mantine/core";

export function OrganizationEventTabs({ slug, value }: { slug: string; value: "upcoming" | "past" }) {
  const router = useRouter();
  return (
    <SegmentedControl
      aria-label="Event view"
      value={value}
      data={[{ label: "Upcoming", value: "upcoming" }, { label: "Past", value: "past" }]}
      onChange={(next) => router.push(next === "past" ? `/${slug}?view=past` : `/${slug}`)}
      styles={{ root: { alignSelf: "flex-start" }, control: { minHeight: 44 } }}
    />
  );
}
