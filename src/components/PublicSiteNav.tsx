"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Box,
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  Menu,
  Stack,
  Text,
} from "@mantine/core";
import { IconBuildingStore, IconChevronDown, IconInfoCircle, IconLogin, IconTicket } from "@tabler/icons-react";
import { logout } from "@/lib/authApi";
import { portalLogout, portalLogoutAll } from "@/lib/portalApi";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  AccountIdentity,
  buildAccountSections,
  PublicAccountMenu,
  type NavConsumer,
  type NavUser,
  type SignOutKind,
} from "@/components/PublicAccountMenu";

const organizerLinks = [
  { label: "Create Organizer Account", href: "/organizers/register", icon: <IconBuildingStore size={16} /> },
  { label: "Log in to Organization Account", href: "/organizers/login", icon: <IconLogin size={16} /> },
  { label: "Explore Mefie for Organizers", href: "/organizers", icon: <IconInfoCircle size={16} /> },
];

export function PublicSiteNav({ user, consumer }: { user: NavUser; consumer: NavConsumer }) {
  const [menuOpened, setMenuOpened] = useState(false);
  const router = useRouter();
  const closeDrawer = () => setMenuOpened(false);

  async function signOut(kind: SignOutKind) {
    if (kind === "organizer") await logout();
    else if (kind === "consumer") await portalLogout();
    else await portalLogoutAll();
    setMenuOpened(false);
    router.refresh();
  }

  const authed = Boolean(user || consumer);
  const drawerSections = buildAccountSections(user, consumer, signOut);

  const forOrganizers = (
    <Menu position="bottom-end" width={240} shadow="md">
      <Menu.Target>
        <Button variant="subtle" rightSection={<IconChevronDown size={14} />}>
          For organizers
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {organizerLinks.map((link) => (
          <Menu.Item key={link.href} component={Link} href={link.href} leftSection={link.icon}>
            {link.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );

  const authButtons = (
    <>
      <Button component={Link} href="/login" variant="subtle">
        Log in
      </Button>
      <Button component={Link} href="/register">
        Sign up
      </Button>
    </>
  );

  return (
    <>
      <Box
        component="header"
        pos="sticky"
        top={0}
        style={{
          zIndex: 100,
          background: "var(--mantine-color-body)",
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        <Container size="xl">
          <Group h={68} justify="space-between" wrap="nowrap">
            <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
              <Group gap="xs" wrap="nowrap">
                <IconTicket size={23} />
                <Text fw={800}>Mefie Tickets</Text>
              </Group>
            </Link>

            <Group visibleFrom="md" gap="xs" wrap="nowrap">
              <Button component={Link} href="/discover" variant="subtle">
                Discover events
              </Button>
              <Button component={Link} href="/tickets" variant="subtle">
                My tickets
              </Button>
              {!user && forOrganizers}
              {authed ? <PublicAccountMenu user={user} consumer={consumer} onSignOut={signOut} /> : authButtons}
              <ThemeToggle />
            </Group>

            <Group hiddenFrom="md">
              <Burger opened={menuOpened} onClick={() => setMenuOpened((v) => !v)} aria-label="Open navigation" />
            </Group>
          </Group>
        </Container>
      </Box>

      <Drawer opened={menuOpened} onClose={closeDrawer} title="Mefie Tickets" position="right">
        <Stack>
          {authed && (
            <>
              <Group px="xs">
                <AccountIdentity user={user} consumer={consumer} withName />
              </Group>
              {drawerSections.map((section) => (
                <Stack key={section.key} gap={4}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700} px="xs">
                    {section.label}
                  </Text>
                  {section.actions.map((action) =>
                    action.href ? (
                      <Button
                        key={action.key}
                        component={Link}
                        href={action.href}
                        variant="subtle"
                        justify="flex-start"
                        color={action.color}
                        leftSection={action.icon}
                        onClick={closeDrawer}
                      >
                        {action.label}
                      </Button>
                    ) : (
                      <Button
                        key={action.key}
                        variant="subtle"
                        justify="flex-start"
                        color={action.color}
                        leftSection={action.icon}
                        onClick={action.onSelect}
                      >
                        {action.label}
                      </Button>
                    ),
                  )}
                </Stack>
              ))}
              <Divider />
            </>
          )}

          <Button component={Link} href="/discover" variant="subtle" justify="flex-start" onClick={closeDrawer}>
            Discover events
          </Button>

          <Button component={Link} href="/tickets" variant="subtle" justify="flex-start" onClick={closeDrawer}>
            My tickets
          </Button>

          {!user && (
            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} px="xs">
                For organizers
              </Text>
              {organizerLinks.map((link) => (
                <Button
                  key={link.href}
                  component={Link}
                  href={link.href}
                  variant="subtle"
                  justify="flex-start"
                  leftSection={link.icon}
                  onClick={closeDrawer}
                >
                  {link.label}
                </Button>
              ))}
            </Stack>
          )}

          {!authed && (
            <>
              <Divider />
              <Button component={Link} href="/login" variant="default" onClick={closeDrawer}>
                Log in
              </Button>
              <Button component={Link} href="/register" onClick={closeDrawer}>
                Sign up
              </Button>
            </>
          )}

          <Divider />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Theme
            </Text>
            <ThemeToggle />
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}
