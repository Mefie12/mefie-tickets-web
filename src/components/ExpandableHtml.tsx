"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Box, UnstyledButton } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";

const COLLAPSED_MAX_PX = 280;
// Only bother with a toggle if there's a meaningful amount hidden —
// clamping something that's only a line or two over just adds a button
// for no real gain.
const OVERFLOW_SLACK_PX = 48;

/**
 * Organizer rich-text (event/series description) that collapses to a
 * fixed height with a fade-out and a "Read more" toggle when it's long,
 * so a wall of text doesn't push the rest of the page — venue, gallery,
 * "how to join" — below the fold.
 *
 * `overflowing` starts true so tall content renders collapsed on the
 * first paint (no expand-then-snap flash); the mask is held back until
 * after the real measurement so short content shows no fade.
 */
export function ExpandableHtml({ html, maw = 700 }: { html: string; maw?: number | string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(true);
  const [measured, setMeasured] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > COLLAPSED_MAX_PX + OVERFLOW_SLACK_PX);
    setMeasured(true);
  }, [html]);

  const collapsed = overflowing && !expanded;

  return (
    <Box maw={maw}>
      <Box
        ref={ref}
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          maxHeight: collapsed ? COLLAPSED_MAX_PX : undefined,
          overflow: collapsed ? "hidden" : undefined,
          maskImage: measured && collapsed ? "linear-gradient(to bottom, #000 62%, transparent)" : undefined,
          WebkitMaskImage: measured && collapsed ? "linear-gradient(to bottom, #000 62%, transparent)" : undefined,
        }}
      />

      {overflowing && (
        <UnstyledButton
          onClick={() => setExpanded((v) => !v)}
          mt="xs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "var(--mantine-font-size-sm)",
            fontWeight: 600,
            color: "var(--mantine-color-anchor)",
          }}
        >
          {expanded ? "Show less" : "Read more"}
          <IconChevronDown
            size={16}
            style={{ transition: "transform 150ms ease", transform: expanded ? "rotate(180deg)" : undefined }}
          />
        </UnstyledButton>
      )}
    </Box>
  );
}
