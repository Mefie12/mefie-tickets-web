"use client";

import { useEffect, useRef } from "react";
import { ActionIcon, Button, Group, Menu } from "@mantine/core";
import { IconCheck, IconChevronLeft, IconChevronRight, IconDots } from "@tabler/icons-react";
import classes from "./scrollableTabsBar.module.css";

export type TabDef = { value: string; label: string };

/**
 * A one-line tab bar for lists too wide to sit comfortably in a `Tabs.List`
 * (which would wrap into a scattered grid). A single-row horizontal strip
 * of pill tabs — the active one scrolls itself into view — bracketed by
 * prev/next steppers (each disabled at its end) and an ellipsis menu of
 * the full list. The steppers are there for anyone who doesn't realise the
 * ellipsis holds the rest.
 *
 * Render it in place of `Tabs.List` inside a controlled `<Tabs value onChange>`.
 */
export function ScrollableTabsBar({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.value === value),
  );
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= tabs.length - 1;

  const stripRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the current pill in view as it changes (e.g. via the stepper).
  useEffect(() => {
    const strip = stripRef.current;
    const pill = activeRef.current;
    if (!strip || !pill) return;
    const target = pill.offsetLeft - strip.clientWidth / 2 + pill.clientWidth / 2;
    strip.scrollLeft = Math.max(0, target);
  }, [activeIndex]);

  return (
    <Group gap="xs" wrap="nowrap" mb="md" align="center" className={classes.bar}>
      <ActionIcon
        variant="default"
        size="lg"
        radius="xl"
        aria-label="Previous tab"
        disabled={isFirst}
        onClick={() => onChange(tabs[Math.max(activeIndex - 1, 0)].value)}
        style={{ flexShrink: 0 }}
      >
        <IconChevronLeft size={16} />
      </ActionIcon>

      <div ref={stripRef} className={classes.strip}>
        {tabs.map((t, i) => (
          <Button
            key={t.value}
            ref={i === activeIndex ? activeRef : undefined}
            size="xs"
            radius="xl"
            variant={t.value === value ? "filled" : "default"}
            onClick={() => onChange(t.value)}
            className={classes.pill}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <ActionIcon
        variant="default"
        size="lg"
        radius="xl"
        aria-label="Next tab"
        disabled={isLast}
        onClick={() => onChange(tabs[Math.min(activeIndex + 1, tabs.length - 1)].value)}
        style={{ flexShrink: 0 }}
      >
        <IconChevronRight size={16} />
      </ActionIcon>

      <Menu position="bottom-end" withinPortal shadow="md" width={220}>
        <Menu.Target>
          <ActionIcon
            variant="default"
            size="lg"
            radius="xl"
            aria-label="All tabs"
            style={{ flexShrink: 0 }}
          >
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {tabs.map((t) => (
            <Menu.Item
              key={t.value}
              onClick={() => onChange(t.value)}
              leftSection={
                t.value === value ? (
                  <IconCheck size={14} />
                ) : (
                  <span style={{ display: "inline-block", width: 14 }} />
                )
              }
              fw={t.value === value ? 600 : undefined}
            >
              {t.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
