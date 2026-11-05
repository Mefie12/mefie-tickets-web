"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Box, UnstyledButton } from "@mantine/core";
import classes from "./ticketDescription.module.css";

// ~3 lines of the xs / 1.5 line-height text in ticketDescription.module.css.
const COLLAPSED_MAX_PX = 54;

/**
 * Renders an organizer's optional ticket description. The HTML is the
 * API's sanitised light rich text (bold, italic, lists — no links), so
 * it's safe to inject; renders nothing when unset.
 *
 * `collapsible` clamps it to ~3 lines with See more / See less — only
 * when it actually overflows, so a short description gets no button.
 * Used where the description sits below a control that must not move
 * (the checkout quantity stepper).
 */
export function TicketDescription({
  html,
  color,
  collapsible = false,
}: {
  html: string | null | undefined;
  color?: string;
  collapsible?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!collapsible || !el) return;
    // scrollHeight is the full content height even while max-height clips it.
    const measure = () => setOverflowing(el.scrollHeight > COLLAPSED_MAX_PX + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsible, html]);

  if (!html) return null;

  const clamped = collapsible && overflowing && !expanded;

  return (
    <Box>
      <Box
        ref={ref}
        className={classes.root}
        c={color}
        dangerouslySetInnerHTML={{ __html: html }}
        style={collapsible && !expanded ? { maxHeight: COLLAPSED_MAX_PX, overflow: "hidden" } : undefined}
      />
      {collapsible && overflowing && (
        <UnstyledButton
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={!clamped}
          fz="xs"
          fw={600}
          mt={4}
          c="var(--mantine-color-blue-7)"
        >
          {clamped ? "See more" : "See less"}
        </UnstyledButton>
      )}
    </Box>
  );
}
