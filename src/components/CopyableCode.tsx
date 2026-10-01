"use client";

import { ActionIcon, CopyButton, Group, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";

/**
 * A promo code that copies with one click — on the code itself or the icon —
 * with a "Copied" confirmation that is announced to screen readers.
 * `size="lg"` is the prominent version for the offer page; the default is a
 * compact inline version for tables.
 */
export function CopyableCode({ value, size = "sm" }: { value: string; size?: "sm" | "lg" }) {
  return (
    <CopyButton value={value} timeout={1800}>
      {({ copied, copy }) => (
        <Group gap={size === "lg" ? 8 : 4} wrap="nowrap" style={{ width: "fit-content" }}>
          <Tooltip label={copied ? "Copied" : "Click to copy"} withArrow position="top">
            <UnstyledButton
              onClick={copy}
              aria-label={copied ? `Copied ${value}` : `Copy promo code ${value}`}
              style={size === "lg" ? {
                padding: "8px 14px",
                borderRadius: "var(--mantine-radius-md)",
                border: "1px dashed var(--mantine-color-default-border)",
                background: "light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))",
              } : undefined}
            >
              <Text ff="monospace" fw={600} fz={size === "lg" ? 20 : "xs"} c={size === "sm" ? "dimmed" : undefined} style={{ letterSpacing: size === "lg" ? 1 : 0 }}>
                {value}
              </Text>
            </UnstyledButton>
          </Tooltip>
          <ActionIcon variant={copied ? "light" : "subtle"} color={copied ? "teal" : "gray"} size={size === "lg" ? "lg" : "sm"} onClick={copy} aria-label={copied ? "Copied" : "Copy promo code"}>
            {copied ? <IconCheck size={size === "lg" ? 18 : 14} /> : <IconCopy size={size === "lg" ? 18 : 14} />}
          </ActionIcon>
          <span role="status" aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{copied ? "Copied to clipboard" : ""}</span>
        </Group>
      )}
    </CopyButton>
  );
}
