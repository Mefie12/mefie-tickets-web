"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Box, UnstyledButton } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import classes from "./expandableHtml.module.css";

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
 * first paint (no expand-then-snap flash); the fade overlay is held
 * back (via `measured`) until after the real measurement so short
 * content shows no fade.
 *
 * The expand/collapse animates `max-height` between two concrete pixel
 * values (`COLLAPSED_MAX_PX` and the measured `fullHeightPx`) — CSS
 * can't smoothly transition to/from `max-height: none`, so both ends of
 * the transition have to be real numbers (see expandableHtml.module.css
 * for the transition/easing). Once fully expanded (`settled`), the cap
 * is lifted entirely (`max-height: none`) so later reflow — e.g. an
 * image inside the organizer's HTML finishing an async load — can't get
 * clipped the way a permanently-pinned pixel value would; collapsing
 * re-measures and re-pins to a fresh pixel value one frame before
 * animating down, since you can't animate away from `none` either.
 * `overflow` stays `hidden` for as long as any cap applies (collapsed,
 * or expanded-but-not-yet-settled) so content never spills past the
 * currently-animating box — it's only `visible` once truly settled.
 */
export function ExpandableHtml({ html, maw = 700 }: { html: string; maw?: number | string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(true);
  const [measured, setMeasured] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fullHeightPx, setFullHeightPx] = useState(COLLAPSED_MAX_PX);
  const [settled, setSettled] = useState(false);

  // Not reusing this from the mount effect below — a `useCallback` in
  // that effect's own deps trips the set-state-in-effect lint rule
  // (it treats a function dependency as a sign of a runaway/cascading
  // effect, even though this one is a stable, single measurement on
  // mount/`html`-change). Small enough duplication to just keep both
  // inline rather than fight the rule.
  const remeasure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > COLLAPSED_MAX_PX + OVERFLOW_SLACK_PX);
    setFullHeightPx(el.scrollHeight);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > COLLAPSED_MAX_PX + OVERFLOW_SLACK_PX);
    setFullHeightPx(el.scrollHeight);
    setMeasured(true);
    setSettled(false);
  }, [html]);

  const collapsed = overflowing && !expanded;
  // Any state where max-height currently constrains the box: fully
  // collapsed, or expanded but the transition to "no cap" hasn't
  // finished (or hasn't started) yet.
  const capped = collapsed || (overflowing && !settled);
  const maxHeight = collapsed ? COLLAPSED_MAX_PX : capped ? fullHeightPx : undefined;

  function toggle() {
    if (expanded) {
      // Collapsing: re-measure and re-pin to a concrete pixel value
      // first — this paints with no visible change, since it matches
      // the content's current rendered height — then, only on the next
      // frame, flip to the collapsed target, so the transition has two
      // real numbers to animate between instead of animating away from
      // `none`.
      remeasure();
      setSettled(false);
      requestAnimationFrame(() => setExpanded(false));
    } else {
      remeasure();
      setExpanded(true);
    }
  }

  return (
    <Box maw={maw}>
      <Box pos="relative">
        <Box
          ref={ref}
          dangerouslySetInnerHTML={{ __html: html }}
          className={classes.content}
          style={{ maxHeight, overflow: capped ? "hidden" : undefined }}
          onTransitionEnd={(e) => {
            if (e.target !== e.currentTarget || e.propertyName !== "max-height") return;
            if (expanded) setSettled(true);
          }}
        />
        <div className={classes.fade} data-visible={(measured && collapsed) || undefined} />
      </Box>

      {overflowing && (
        <UnstyledButton
          onClick={toggle}
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
