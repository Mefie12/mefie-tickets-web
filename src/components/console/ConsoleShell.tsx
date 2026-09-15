"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Group,
  Menu,
  Overlay,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure, useLocalStorage, useMediaQuery } from "@mantine/hooks";
import {
  IconChevronRight,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconX,
} from "@tabler/icons-react";
import { ConsoleNavProvider } from "./ConsoleNav";
import classes from "./console.module.css";

const EXPANDED_WIDTH = 260;
const RAIL_WIDTH = 80;
// Mantine `sm` — must match the AppShell navbar `breakpoint` below.
const DESKTOP_QUERY = "(min-width: 48em)";
// 768-991px — the persistent sidebar's own width (260px) eats over a third
// of a tablet's viewport at this range, before any page content even
// starts. Matches eventOperationsNav.module.css's 62em ("md and up")
// breakpoint, so the sidebar and the event sub-nav agree on what counts
// as "tablet" vs "desktop".
const TABLET_QUERY = "(min-width: 48em) and (max-width: 61.9375em)";

export type ConsoleBrand = {
  /** ~24-28px mark. */
  logo: ReactNode;
  primary: string;
  secondary?: string;
  /** Platform console: tints the card to keep its privileged identity. */
  accent?: boolean;
};

export type ConsoleAccount = {
  initials: string;
  name: string;
  email: string;
  avatarColor?: string;
  /** <Menu.Item> list rendered into the account card's dropdown. */
  menuItems: ReactNode;
};

/**
 * The shared console chrome for every authenticated shell — a Mantine
 * AppShell whose sidebar (an inset card, BMN reference) stacks a brand
 * card, the scrolling nav, and an account card.
 *
 *  - Mobile (< sm): sidebar hidden; a header Burger slides it in as a
 *    bounded drawer over a click-to-dismiss backdrop. Auto-closes on
 *    navigation. The desktop rail preference never applies here.
 *  - Desktop (>= sm): sidebar always visible; a header toggle (far left,
 *    beside the sidebar) collapses it between a 260px list and an 80px
 *    icon rail. Preference persisted.
 *
 * The header is deliberately sparse — collapse toggle on the left,
 * `headerEnd` (theme toggle) on the right. Brand and account live in the
 * sidebar.
 */
export function ConsoleShell({
  brand,
  account,
  nav,
  headerEnd,
  banner,
  children,
  storageKey = "console-nav-collapsed",
}: {
  brand: ConsoleBrand;
  account: ConsoleAccount;
  nav: ReactNode;
  headerEnd?: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
  storageKey?: string;
}) {
  const pathname = usePathname();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  // `null` means the organizer has never explicitly toggled this — once
  // they do, setCollapsed always writes a real boolean, which then wins
  // over the tablet default on every device from then on (same
  // cross-device persistence useLocalStorage already gave the manual
  // toggle before this change).
  const [storedCollapsed, setCollapsed] = useLocalStorage<boolean | null>({ key: storageKey, defaultValue: null });
  // Desktop-first: assume desktop before the effect resolves so the server
  // render and first paint match the common (desktop) case.
  const isDesktop = useMediaQuery(DESKTOP_QUERY, true);
  // No stored preference yet: default to the icon rail specifically in the
  // 768-991px range, where the full 260px sidebar leaves barely 460px for
  // actual content — full desktop widths keep the previous expanded
  // default. Stays reactive to live viewport changes (e.g. a tablet
  // rotating) for as long as no explicit preference has been set.
  const isTablet = useMediaQuery(TABLET_QUERY, false) ?? false;
  const collapsed = storedCollapsed ?? isTablet;
  const railCollapsed = isDesktop ? collapsed : false;

  // Tapping any nav link on mobile navigates — dismiss the drawer with it.
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  return (
    <AppShell
      // `alt`: the sidebar spans the full viewport height (no header bar
      // cutting across above it, BMN-style); the header is offset to sit
      // only over the content column, so the collapse toggle at its left
      // lands right beside the sidebar's brand card.
      layout="alt"
      header={{ height: 60 }}
      navbar={{
        width: collapsed ? RAIL_WIDTH : EXPANDED_WIDTH,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened, desktop: false },
      }}
      padding="md"
      // Mantine's own scale is app:100 < modal:200 < popover:300 < overlay:400
      // (see --mantine-z-index-* in @mantine/core/styles.css) — this used to
      // be 200, tied with Modal's own z-index, which ties resolve by DOM/paint
      // order rather than a documented rule. That let the navbar render over
      // an open Modal (e.g. "Add ticket type") whenever the mobile drawer was
      // open. Staying at the "app chrome" tier keeps every Modal/Popover in
      // the app correctly above the nav, not just this one call site.
      zIndex={100}
      // CSS transitions on the AppShell navbar (width AND transform) stall
      // mid-tween under dev re-renders / Fast Refresh and leave the navbar
      // stuck in an intermediate state. Snap instead.
      transitionDuration={0}
    >
      <AppShell.Header withBorder={false} className={classes.header}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Burger
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
              aria-label="Toggle navigation"
            />
            <ActionIcon
              visibleFrom="sm"
              variant="subtle"
              color="gray"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <IconLayoutSidebarLeftExpand size={20} />
              ) : (
                <IconLayoutSidebarLeftCollapse size={20} />
              )}
            </ActionIcon>
          </Group>

          <Group gap="sm" wrap="nowrap">
            {headerEnd}
            <HeaderAccountMenu account={account} />
          </Group>
        </Group>
      </AppShell.Header>

      {mobileOpened && (
        <Overlay hiddenFrom="sm" onClick={closeMobile} zIndex={99} fixed backgroundOpacity={0.55} />
      )}

      <AppShell.Navbar
        p={railCollapsed ? "xs" : "md"}
        className={`${classes.navbar}${mobileOpened ? ` ${classes.navbarOpen}` : ""}`}
      >
        <ConsoleNavProvider collapsed={railCollapsed}>
          <Group hiddenFrom="sm" justify="space-between" wrap="nowrap" mb={4}>
            <Text fw={600} size="sm" c="dimmed">
              Menu
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={closeMobile}
              aria-label="Close navigation"
            >
              <IconX size={18} />
            </ActionIcon>
          </Group>
          <BrandCard brand={brand} collapsed={railCollapsed} />
          {nav}
          <AccountCard account={account} collapsed={railCollapsed} />
        </ConsoleNavProvider>
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        {banner}
        {children}
      </AppShell.Main>
    </AppShell>
  );
}

function BrandCard({ brand, collapsed }: { brand: ConsoleBrand; collapsed: boolean }) {
  return (
    <div
      className={classes.brandCard}
      data-accent={brand.accent || undefined}
      data-collapsed={collapsed || undefined}
    >
      <span className={classes.brandLogo}>{brand.logo}</span>
      {!collapsed && (
        <span className={classes.brandText}>
          <Text fw={700} size="sm" truncate>
            {brand.primary}
          </Text>
          {brand.secondary && (
            <Text size="xs" c="dimmed" truncate>
              {brand.secondary}
            </Text>
          )}
        </span>
      )}
    </div>
  );
}

function AccountCard({ account, collapsed }: { account: ConsoleAccount; collapsed: boolean }) {
  return (
    <Menu position="right-end" withArrow shadow="md" width={230} withinPortal>
      <Menu.Target>
        <UnstyledButton
          className={classes.accountCard}
          data-collapsed={collapsed || undefined}
          aria-label="Account menu"
        >
          <Avatar radius="xl" size={collapsed ? 32 : 36} color={account.avatarColor}>
            {account.initials}
          </Avatar>
          {!collapsed && (
            <>
              <span className={classes.accountText}>
                <Text fw={600} size="sm" truncate>
                  {account.name}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {account.email}
                </Text>
              </span>
              <IconChevronRight size={16} style={{ flexShrink: 0, opacity: 0.6 }} />
            </>
          )}
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>{account.menuItems}</Menu.Dropdown>
    </Menu>
  );
}

/**
 * The same account menu also lives in the header, top-right — a second,
 * always-visible entry point that doesn't require the sidebar to be open
 * (or, on mobile, the drawer to be pulled out) just to log out or leave
 * the console.
 */
function HeaderAccountMenu({ account }: { account: ConsoleAccount }) {
  return (
    <Menu position="bottom-end" withArrow shadow="md" width={230}>
      <Menu.Target>
        <UnstyledButton aria-label="Account menu">
          <Avatar radius="xl" size={32} color={account.avatarColor}>
            {account.initials}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>{account.menuItems}</Menu.Dropdown>
    </Menu>
  );
}
