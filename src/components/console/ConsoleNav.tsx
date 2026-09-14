"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { AppShell, Box, NavLink, ScrollArea, Text, Tooltip } from "@mantine/core";
import classes from "./console.module.css";

type ConsoleNavContextValue = { collapsed: boolean };

const ConsoleNavContext = createContext<ConsoleNavContextValue>({ collapsed: false });

/** Set by ConsoleShell so nav primitives know whether to render the icon rail. */
export function ConsoleNavProvider({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  return <ConsoleNavContext.Provider value={{ collapsed }}>{children}</ConsoleNavContext.Provider>;
}

function useConsoleNav() {
  return useContext(ConsoleNavContext);
}

/**
 * The scrolling nav-items region — the middle band of the sidebar, between
 * ConsoleShell's brand card and account card. Grows to fill the column.
 */
export function ConsoleNav({ children }: { children: ReactNode }) {
  return (
    <AppShell.Section
      grow
      component={ScrollArea}
      scrollbarSize={6}
      type="hover"
      className={classes.navScroll}
    >
      {children}
    </AppShell.Section>
  );
}

/**
 * A titled group. Expanded: an uppercase caption. Collapsed to the icon rail:
 * the caption is dropped and groups are separated by spacing only (BMN
 * reference — no divider lines).
 */
export function ConsoleNavSection({ label, children }: { label: string; children: ReactNode }) {
  const { collapsed } = useConsoleNav();

  if (collapsed) {
    return <Box mt="sm">{children}</Box>;
  }

  return (
    <>
      <Text
        tt="uppercase"
        fz={12}
        fw={500}
        c="dimmed"
        px="sm"
        mt="md"
        mb={4}
        style={{ letterSpacing: "0.6px" }}
      >
        {label}
      </Text>
      {children}
    </>
  );
}

/** A single nav link. Collapsed: icon-only, centered, with a right-side tooltip. */
export function ConsoleNavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  const { collapsed } = useConsoleNav();

  if (collapsed) {
    return (
      <Tooltip
        label={label}
        position="right"
        withArrow
        openDelay={0}
        events={{ hover: true, focus: true, touch: false }}
      >
        <NavLink
          component={Link}
          href={href}
          aria-label={label}
          active={active}
          leftSection={icon}
          styles={{
            root: { justifyContent: "center", paddingInline: 8 },
            body: { display: "none" },
            section: { marginInlineEnd: 0 },
          }}
        />
      </Tooltip>
    );
  }

  return <NavLink component={Link} href={href} label={label} leftSection={icon} active={active} />;
}
