"use client";

import { ActionIcon, Tooltip, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";

export function ThemeToggle({ color }: { color?: string }) {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const nextScheme = computedColorScheme === "dark" ? "light" : "dark";
  const label = `Switch to ${nextScheme} theme`;

  return (
    <Tooltip label={label} withArrow>
      <ActionIcon
        variant="subtle"
        color={color}
        size="lg"
        aria-label={label}
        onClick={() => setColorScheme(nextScheme)}
      >
        {computedColorScheme === "dark" ? <IconSun size={19} /> : <IconMoon size={19} />}
      </ActionIcon>
    </Tooltip>
  );
}
