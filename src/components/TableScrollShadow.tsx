"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Table } from "@mantine/core";
import classes from "./tableScrollShadow.module.css";

/**
 * Drop-in replacement for `Table.ScrollContainer` that adds a left/right
 * edge fade wherever the table actually has more columns scrolled out of
 * view — each fade disappears once you've scrolled all the way to that
 * edge. Without this, a table wider than its container (routine at
 * tablet width, where the persistent sidebar leaves ~460px for content —
 * see the console responsiveness audit) just looks like it ends, with
 * nothing hinting that columns like Amount/Status/Action are one swipe
 * away, and a touch scrollbar is invisible until dragged.
 */
export function TableScrollShadow({ minWidth, children }: { minWidth: number; children: React.ReactNode }) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const updateShadows = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setCanScrollLeft(viewport.scrollLeft > 1);
    setCanScrollRight(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1);
  }, []);

  // onScrollPositionChange alone only fires once you actually scroll — this
  // also catches the initial overflow state and later content/layout
  // changes (rows loading in, the sidebar collapsing next to this table).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    updateShadows();
    const observer = new ResizeObserver(updateShadows);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [updateShadows]);

  return (
    <Box pos="relative">
      <Table.ScrollContainer minWidth={minWidth} scrollAreaProps={{ viewportRef, onScrollPositionChange: updateShadows }}>
        {children}
      </Table.ScrollContainer>
      <div className={classes.shadowLeft} data-visible={canScrollLeft || undefined} />
      <div className={classes.shadowRight} data-visible={canScrollRight || undefined} />
    </Box>
  );
}
