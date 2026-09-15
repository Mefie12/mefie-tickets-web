import Link from "next/link";
import { Box, Container, Group, Paper, Stack, Text } from "@mantine/core";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MefieLogo } from "@/components/MefieLogo";
import { brandTextColor } from "@/theme";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Box pos="relative" mih="100vh">
      <Box pos="absolute" top={16} right={16}><ThemeToggle /></Box>
    <Container size="xs" py={80}>
      <Stack gap="xl">
        <Group justify="center">
          <Link href="/" aria-label="Mefie Tickets home">
            <MefieLogo h={24} />
          </Link>
        </Group>

        <Stack gap={4} align="center">
          <Text component="h1" c={brandTextColor} fz={28} fw={800} ta="center">
            {title}
          </Text>
          {subtitle && (
            <Text c="dimmed" size="sm" ta="center" maw={380}>
              {subtitle}
            </Text>
          )}
        </Stack>

        <Paper withBorder radius="lg" shadow="md" p="xl">
          {children}
        </Paper>
      </Stack>
    </Container>
    </Box>
  );
}
